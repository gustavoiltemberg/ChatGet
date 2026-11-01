const { WebSocketServer } = require("ws");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const HISTORY_FILE = path.join(__dirname, "historico.json");
const USERS_FILE = path.join(__dirname, "usuarios.json");

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

// Mapa para guardar quem está conectado agora (WebSocket -> Nome)
const connectedUsers = new Map();

// ================= FUNÇÕES DE USUÁRIO =================
function getUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    } catch (e) { console.error(e); }
    return [];
}

function saveUser(user) {
    const users = getUsers();
    users.push(user);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function deleteUserByName(name) {
    let users = getUsers();
    users = users.filter(u => u.name !== name);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ================= FUNÇÕES DE HISTÓRICO =================
function getHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
    } catch (e) { console.error(e); }
    return [];
}

function saveMessage(message) {
    const history = getHistory();
    history.push(message);
    if (history.length > 100) history.shift();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function setHistory(history) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ================= FUNÇÃO PARA MONTAR A LISTA COMPLETA =================
function broadcastUsersList() {
    const allUsers = getUsers();
    const onlineNames = Array.from(connectedUsers.values());

    const usersList = allUsers.map(user => ({
        name: user.name,
        online: onlineNames.includes(user.name)
    }));

    if (onlineNames.includes(ADMIN_USER) && !usersList.find(u => u.name === ADMIN_USER)) {
        usersList.push({ name: ADMIN_USER, online: true });
    }

    const message = JSON.stringify({ 
        type: "users_list", 
        users: usersList 
    });

    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(message);
        }
    });
}

// ================= SERVIDOR WEBSOCKET =================
const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

wss.on("connection", (ws) => {
    ws.on("error", console.error);

    ws.on("close", () => {
        if (connectedUsers.has(ws)) {
            const name = connectedUsers.get(ws);
            
            // 1. Avisa os OUTROS que o usuário saiu
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === 1) {
                    client.send(JSON.stringify({ 
                        type: "system_message", 
                        content: `👈 ${name} saiu do chat.` 
                    }));
                }
            });

            // 2. Remove o usuário da lista de conectados
            connectedUsers.delete(ws);
            broadcastUsersList(); 
        }
    });

    ws.on("message", (data) => {
        const messageString = data.toString();
        
        try {
            const messageObj = JSON.parse(messageString);

            // 1. CADASTRO
            if (messageObj.type === "register") {
                const users = getUsers();
                if (users.find(u => u.name === messageObj.name)) {
                    ws.send(JSON.stringify({ type: "auth_error", message: "Usuário já existe!" }));
                } else {
                    saveUser({ name: messageObj.name, password: messageObj.password });
                    ws.send(JSON.stringify({ type: "auth_success", message: "Cadastro realizado! Faça login." }));
                    broadcastUsersList(); 
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
                    const users = getUsers();
                    const user = users.find(u => u.name === messageObj.name && u.password === messageObj.password);
                    if (user) loginSuccess = true;
                }
                
                if (loginSuccess) {
                    connectedUsers.set(ws, messageObj.name);

                    ws.send(JSON.stringify({ type: "login_success", isAdmin: isAdmin }));
                    const history = getHistory();
                    history.forEach(msg => ws.send(JSON.stringify(msg)));

                    // Avisa todos os OUTROS que o usuário entrou
                    wss.clients.forEach((client) => {
                        if (client !== ws && client.readyState === 1) {
                            client.send(JSON.stringify({ 
                                type: "system_message", 
                                content: `👉 ${messageObj.name} entrou no chat!` 
                            }));
                        }
                    });

                    broadcastUsersList(); 
                } else {
                    ws.send(JSON.stringify({ type: "auth_error", message: "Nome ou senha incorretos!" }));
                }
                return;
            }

            // 3. APAGAR MENSAGEM (Admin)
            if (messageObj.type === "delete_message" && messageObj.isAdmin) {
                let history = getHistory();
                history = history.filter(msg => msg.timestamp !== messageObj.messageId);
                setHistory(history);
                
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ type: "message_deleted", messageId: messageObj.messageId }));
                    }
                });
                return;
            }

            // 4. LIMPAR TUDO (Admin)
            if (messageObj.type === "clear_all" && messageObj.isAdmin) {
                setHistory([]);
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ type: "all_cleared" }));
                    }
                });
                return;
            }

            // 5. EXCLUIR USUÁRIO (Admin)
            if (messageObj.type === "delete_user" && messageObj.isAdmin) {
                if (messageObj.userName !== ADMIN_USER) {
                    deleteUserByName(messageObj.userName);
                    
                    for (let [clientWs, name] of connectedUsers.entries()) {
                        if (name === messageObj.userName) {
                            clientWs.send(JSON.stringify({ 
                                type: "auth_error", 
                                message: "Sua conta foi excluída pelo administrador." 
                            }));
                            clientWs.close(); 
                            break;
                        }
                    }

                    broadcastUsersList(); 
                }
                return;
            }

            // 6. MENSAGEM DE CHAT NORMAL
            if (messageObj.content) {
                messageObj.timestamp = Date.now();
                saveMessage(messageObj);
                
                // Envia para TODOS (incluindo quem enviou)
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