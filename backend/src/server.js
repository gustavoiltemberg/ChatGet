const { WebSocketServer } = require("ws");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs"); // Trocado para bcryptjs
const db = require("./db");

dotenv.config();

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_PASS) {
  console.error("❌ Defina ADMIN_PASS no arquivo .env");
  process.exit(1);
}

const connectedUsers = new Map();

async function broadcastUsersList() {
  const allUsers = await db.getUsers();
  const onlineNames = Array.from(connectedUsers.values());

  const usersList = allUsers.map((user) => ({
    name: user.name,
    online: onlineNames.includes(user.name),
  }));

  if (onlineNames.includes(ADMIN_USER) && !usersList.find((u) => u.name === ADMIN_USER)) {
    usersList.push({ name: ADMIN_USER, online: true });
  }

  const message = JSON.stringify({ type: "users_list", users: usersList });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
}

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

wss.on("connection", (ws) => {
  ws.on("error", console.error);

  ws.on("close", async () => {
    if (connectedUsers.has(ws)) {
      const name = connectedUsers.get(ws);

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(
            JSON.stringify({
              type: "system_message",
              content: `👈 ${name} saiu do chat.`,
            })
          );
        }
      });

      connectedUsers.delete(ws);
      await broadcastUsersList();
    }
  });

  ws.on("message", async (data) => {
    try {
      const messageObj = JSON.parse(data.toString());

      // 1. CADASTRO
      if (messageObj.type === "register") {
        const existingUser = await db.getUserByName(messageObj.name);
        if (existingUser) {
          ws.send(JSON.stringify({ type: "auth_error", message: "Usuário já existe!" }));
        } else {
          const hash = await bcrypt.hash(messageObj.password, 10);
          await db.saveUser({ name: messageObj.name, password: hash });
          ws.send(JSON.stringify({ type: "auth_success", message: "Cadastro realizado! Faça login." }));
          await broadcastUsersList();
        }
        return;
      }

      // 2. LOGIN
      if (messageObj.type === "login") {
        let isAdmin = false;
        let loginSuccess = false;

        if (messageObj.name === ADMIN_USER && messageObj.password === ADMIN_PASS) {
          isAdmin = true;
          loginSuccess = true;
        } else {
          const user = await db.getUserByName(messageObj.name);
          if (user && (await bcrypt.compare(messageObj.password, user.password))) {
            loginSuccess = true;
          }
        }

        if (loginSuccess) {
          connectedUsers.set(ws, messageObj.name);
          ws.send(JSON.stringify({ type: "login_success", isAdmin }));

          const history = await db.getHistory();
          history.forEach((msg) => ws.send(JSON.stringify(msg)));

          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: "system_message",
                  content: `👉 ${messageObj.name} entrou no chat!`,
                })
              );
            }
          });

          await broadcastUsersList();
        } else {
          ws.send(JSON.stringify({ type: "auth_error", message: "Nome ou senha incorretos!" }));
        }
        return;
      }

      // 3. APAGAR MENSAGEM
      if (messageObj.type === "delete_message" && messageObj.isAdmin) {
        await db.deleteMessageByTimestamp(messageObj.messageId);
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ type: "message_deleted", messageId: messageObj.messageId }));
          }
        });
        return;
      }

      // 4. LIMPAR TUDO
      if (messageObj.type === "clear_all" && messageObj.isAdmin) {
        await db.clearAllMessages();
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ type: "all_cleared" }));
          }
        });
        return;
      }

      // 5. EXCLUIR USUÁRIO
      if (messageObj.type === "delete_user" && messageObj.isAdmin) {
        if (messageObj.userName !== ADMIN_USER) {
          await db.deleteUserByName(messageObj.userName);

          for (let [clientWs, name] of connectedUsers.entries()) {
            if (name === messageObj.userName) {
              clientWs.send(JSON.stringify({ type: "auth_error", message: "Sua conta foi excluída pelo administrador." }));
              clientWs.close();
              break;
            }
          }
          await broadcastUsersList();
        }
        return;
      }

      // 6. MENSAGEM NORMAL
      if (messageObj.content) {
        messageObj.timestamp = Date.now();
        await db.saveMessage(messageObj);

        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(messageObj));
          }
        });
      }
    } catch (e) {
      console.error("Erro no servidor:", e);
    }
  });
});

console.log(`✅ Chat rodando na porta ${process.env.PORT || 8080}`);