// Elementos do DOM
const loginSection = document.querySelector(".login");
const loginForm = document.querySelector("#auth-form");
const chatSection = document.querySelector(".chat");
const chatForm = chatSection.querySelector(".chat__form");
const chatInput = chatSection.querySelector(".chat__input");
const chatMessages = chatSection.querySelector(".chat__messages");
const adminBar = document.querySelector("#admin-bar");
const btnClearAll = document.querySelector("#btn-clear-all");
const btnLogout = document.querySelector("#btn-logout");
const btnSom = document.querySelector("#btn-som");
const stickersBar = document.querySelector("#stickers-bar");
const btnGifKeyboard = document.querySelector("#btn-gif-keyboard");

// Configuração dos Áudios
const audioEntrou = new Audio("./sounds/entrou.mp3");
const audioSaiu = new Audio("./sounds/saiu.mp3");
const audioMensagem = new Audio("./sounds/mensagem.mp3");

audioEntrou.volume = 1.0;
audioSaiu.volume = 1.0;
audioMensagem.volume = 1.0;

let somAtivado = false;

// Elementos da Lista de Usuários
const onlineList = document.querySelector("#online-list");
const onlineCount = document.querySelector("#online-count");

// Elementos de Autenticação
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const formTitle = document.querySelector("#form-title");
const submitBtn = document.querySelector("#submit-btn");
const toggleMsg = document.querySelector("#toggle-msg");
const toggleLink = document.querySelector("#toggle-auth");

const colors = ["cadetblue", "darkgoldenrod", "cornflowerblue", "darkkhaki", "hotpink", "gold"];
const user = { id: "", name: "", color: "", isAdmin: false };

let websocket;
let isLoginMode = true;

// ================= FUNÇÕES AUXILIARES =================
const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];
const scrollScreen = () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

const isImageURL = (url) => {
    const urlLower = url.toLowerCase();
    if (urlLower.match(/\.(gif|jpe?g|png|webp|bmp)$/)) return true;
    if (urlLower.includes("media.giphy.com") || urlLower.includes("i.giphy.com") || urlLower.includes("tenor.com") || urlLower.includes("giphy.com/gifs")) return true;
    if (urlLower.includes("./emojis/")) return true; 
    return false;
};

const formatMessageContent = (content) => {
    if (isImageURL(content)) {
        return `<img src="${content}" alt="Imagem" />`;
    }
    return content;
};

const createSystemMessage = (content) => {
    const div = document.createElement("div");
    div.classList.add("message--system");
    div.innerHTML = content;
    return div;
};

const createMessageElement = (msg) => {
    const div = document.createElement("div");
    div.dataset.id = msg.timestamp; 

    let btnDelete = "";
    if (user.isAdmin) {
        btnDelete = `<button class="delete-btn" data-id="${msg.timestamp}">[Apagar]</button>`;
    }

    const formattedContent = formatMessageContent(msg.content);

    if (msg.userId === user.id) {
        div.classList.add("message--self");
        div.innerHTML = `<div class="message--content">${formattedContent}</div> ${btnDelete}`;
    } else {
        div.classList.add("message--other");
        div.innerHTML = `
            <span class="message--sender" style="color: ${msg.userColor}">${msg.userName}</span>
            <div class="message--content">${formattedContent}</div> ${btnDelete}
        `;
    }

    if (user.isAdmin) {
        const btn = div.querySelector('.delete-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                websocket.send(JSON.stringify({ type: "delete_message", messageId: msg.timestamp, isAdmin: true }));
            });
        }
    }
    return div;
};

const updateUsersList = (users) => {
    onlineList.innerHTML = "";
    
    const loggedUsers = users.filter(u => u.online);
    onlineCount.innerText = loggedUsers.length;

    users.sort((a, b) => {
        if (a.online === b.online) {
            return a.name.localeCompare(b.name);
        }
        return a.online ? -1 : 1;
    });

    users.forEach(u => {
        const li = document.createElement("li");
        
        const userInfo = document.createElement("div");
        userInfo.classList.add("user-info");
        userInfo.innerText = u.name;
        li.appendChild(userInfo);

        if (u.online) {
            li.classList.add("user--online"); 
        } else {
            li.classList.add("user--guest"); 
        }

        if (user.isAdmin && u.name !== "admin") {
            const btnDeleteUser = document.createElement("button");
            btnDeleteUser.innerHTML = "✖"; 
            btnDeleteUser.classList.add("btn-delete-user");
            
            btnDeleteUser.addEventListener("click", () => {
                if (confirm(`Tem certeza que deseja excluir o usuário "${u.name}"?`)) {
                    websocket.send(JSON.stringify({ 
                        type: "delete_user", 
                        userName: u.name, 
                        isAdmin: true 
                    }));
                }
            });
            
            li.appendChild(btnDeleteUser);
        }
        
        onlineList.appendChild(li);
    });
};

// ================= LÓGICA DE WEBSOCKET =================
const connectWebSocket = () => {
    websocket = new WebSocket("ws://chatget-r7es.onrender.com");

    websocket.onmessage = ({ data }) => {
        const msg = JSON.parse(data);

        if (msg.type === "auth_error") {
            alert(msg.message);
            if (msg.message.includes("excluída")) {
                btnLogout.click();
            }
        } 
        else if (msg.type === "auth_success") {
            alert(msg.message);
            passwordInput.value = "";
            if (!isLoginMode) toggleLink.click();
        } 
        else if (msg.type === "login_success") {
            loginSection.style.display = "none";
            chatSection.style.display = "flex";
            
            if (!somAtivado) {
                btnSom.style.display = "block";
            }

            if (msg.isAdmin) {
                user.isAdmin = true;
                document.body.classList.add("is-admin");
                adminBar.style.display = "block";
            }
        } 
        else if (msg.type === "users_list") {
            updateUsersList(msg.users);
        }
        else if (msg.type === "system_message") {
            const sysMsgElement = createSystemMessage(msg.content);
            chatMessages.appendChild(sysMsgElement);
            scrollScreen();

            // Toca o som de ENTRADA ou SAÍDA
            if (somAtivado) {
                if (msg.content.includes("👉")) {
                    audioEntrou.currentTime = 0;
                    audioEntrou.play().catch(e => console.log("Erro ao tocar som de entrada:", e));
                } else if (msg.content.includes("👈")) {
                    audioSaiu.currentTime = 0;
                    audioSaiu.play().catch(e => console.log("Erro ao tocar som de saída:", e));
                }
            }
        }
        else if (msg.type === "message_deleted") {
            const msgElement = chatMessages.querySelector(`[data-id="${msg.messageId}"]`);
            if (msgElement) msgElement.remove();
        }
        else if (msg.type === "all_cleared") {
            chatMessages.innerHTML = "";
        }
        else {
            // É uma mensagem de chat normal. Exibe e TOCA o som (para todos)
            const messageElement = createMessageElement(msg);
            chatMessages.appendChild(messageElement);
            scrollScreen();

            // Toca o som de mensagem para TODOS que receberem
            if (somAtivado) {
                audioMensagem.currentTime = 0;
                audioMensagem.play().catch(e => console.log("Erro ao tocar som de mensagem:", e));
            }
        }
    };
};

// ================= EVENTOS =================
toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    formTitle.innerText = isLoginMode ? "Login" : "Cadastro";
    submitBtn.innerText = isLoginMode ? "Entrar" : "Cadastrar";
    toggleMsg.innerText = isLoginMode ? "Não tem conta?" : "Já tem conta?";
    toggleLink.innerText = isLoginMode ? "Cadastre-se" : "Faça Login";
});

loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!websocket) connectWebSocket();

    const name = usernameInput.value;
    const password = passwordInput.value;

    if (isLoginMode) {
        user.name = name;
        user.id = crypto.randomUUID();
        user.color = getRandomColor();
        websocket.send(JSON.stringify({ type: "login", name, password }));
    } else {
        websocket.send(JSON.stringify({ type: "register", name, password }));
    }
});

connectWebSocket();

// BOTÃO DE ATIVAR SOM
btnSom.addEventListener("click", () => {
    audioEntrou.currentTime = 0;
    audioEntrou.play()
        .then(() => {
            somAtivado = true;
            btnSom.style.display = "none"; 
            console.log("✅ Som liberado e ativado com sucesso!");
        })
        .catch(e => {
            console.error("❌ Erro ao tocar o som. Motivo:", e);
            alert("O navegador não conseguiu tocar o som. Verifique se o arquivo 'entrou.mp3' está na pasta 'sounds'.");
        });
});

// Botão de GIF (Abre/Fecha Emoticons)
btnGifKeyboard.addEventListener("click", () => {
    stickersBar.classList.toggle("show");
    btnGifKeyboard.classList.toggle("active");
    if (stickersBar.classList.contains("show")) {
        chatInput.focus();
    }
});

chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = chatInput.value.trim();
    if (!content) return;

    const message = {
        userId: user.id,
        userName: user.name,
        userColor: user.color,
        content: content
    };

    websocket.send(JSON.stringify(message));
    chatInput.value = "";
});

stickersBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".sticker-btn");
    if (btn) {
        const emoji = btn.dataset.emoji;
        const message = {
            userId: user.id,
            userName: user.name,
            userColor: user.color,
            content: emoji
        };
        websocket.send(JSON.stringify(message));
    }
});

btnClearAll.addEventListener("click", () => {
    if (confirm("Tem certeza que deseja apagar TODAS as mensagens? Isso não pode ser desfeito.")) {
        websocket.send(JSON.stringify({ type: "clear_all", isAdmin: true }));
    }
});

btnLogout.addEventListener("click", () => {
    // NOVO: Toca o som de saída para o PRÓPRIO usuário antes de fechar o WebSocket
    if (somAtivado) {
        audioSaiu.currentTime = 0;
        audioSaiu.play().catch(e => console.log("Erro ao tocar som de saída local:", e));
    }

    if (websocket) {
        websocket.close();
        websocket = null;
    }
    user.id = ""; user.name = ""; user.color = ""; user.isAdmin = false;
    document.body.classList.remove("is-admin");
    chatMessages.innerHTML = "";
    adminBar.style.display = "none";
    chatSection.style.display = "none";
    loginSection.style.display = "block";
    usernameInput.value = ""; passwordInput.value = "";
    
    onlineList.innerHTML = "";
    onlineCount.innerText = "0";
    
    stickersBar.classList.remove("show");
    btnGifKeyboard.classList.remove("active");
    btnSom.style.display = "none"; 
    
    if (!isLoginMode) toggleLink.click();
    
    connectWebSocket();
});
