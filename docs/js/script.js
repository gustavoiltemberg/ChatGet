// =====================================================================
// IMPORTS
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    sendPasswordResetEmail, verifyBeforeUpdateEmail, updateProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc,
    getDocs, getDoc, writeBatch, setDoc, limit, where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    marcarComoDigitando,
    pararDeDigitar,
    ouvirDigitando,
    formatarTextoDigitando,
    criarDebounce
} from "./typing.js";

import { anunciarEntrada, anunciarSaida } from "./presence.js";

import { obterUrlAvatar } from "./avatar.js";

import { iniciarJogoDamas } from "./damas.js";


// =====================================================================
// CONFIGURAÇÃO DO FIREBASE
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDZlENtMvC3u6HRr4T1n_TnnlbkxRfNid4",
  authDomain: "chat-get-ed551.firebaseapp.com",
  projectId: "chat-get-ed551",
  storageBucket: "chat-get-ed551.firebasestorage.app",
  messagingSenderId: "965666495086",
  appId: "1:965666495086:web:78b4dd87a74723d5c9a47f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// =====================================================================
// ELEMENTOS DO DOM
// =====================================================================
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
const btnEditName = document.querySelector("#btn-edit-name");
const btnEditEmail = document.querySelector("#btn-edit-email");
const stickersBar = document.querySelector("#stickers-bar");
const btnGifKeyboard = document.querySelector("#btn-gif-keyboard");

// 🔑 FIXAR: Novos elementos do DOM para a barra de fixados
const pinnedBar = document.querySelector("#pinned-message-bar");
const pinnedText = document.querySelector("#pinned-text");
const btnUnpin = document.querySelector("#btn-unpin");

const emailInput = document.querySelector("#email");
const forgotPasswordContainer = document.querySelector("#forgot-password-container");
const forgotPasswordLink = document.querySelector("#forgot-password");

const btnManageBans = document.querySelector("#btn-manage-bans");
const bansModal = document.querySelector("#bans-modal");
const closeBansModal = document.querySelector("#close-bans-modal");
const bansList = document.querySelector("#bans-list");

const onlineList = document.querySelector("#online-list");
const onlineCount = document.querySelector("#online-count");

const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const formTitle = document.querySelector("#form-title");
const submitBtn = document.querySelector("#submit-btn");
const toggleMsg = document.querySelector("#toggle-msg");
const toggleLink = document.querySelector("#toggle-auth");


// =====================================================================
// INDICADOR DE DIGITAÇÃO (UI)
// =====================================================================
const typingIndicator = document.createElement("div");
typingIndicator.className = "typing-indicator";
typingIndicator.style.display = "none";
chatForm.parentNode.insertBefore(typingIndicator, chatForm);


// =====================================================================
// ÁUDIOS
// =====================================================================
const audioMensagem = new Audio("./sounds/mensagem.mp3");
const audioEntrou = new Audio("./sounds/entrou.mp3"); 
const audioSaiu = new Audio("./sounds/saiu.mp3");     

audioMensagem.volume = 1.0;
audioEntrou.volume = 1.0;
audioSaiu.volume = 1.0;

// ✅ FUNÇÃO PARA DESBLOQUEAR OS ÁUDIOS NO NAVEGADOR
const desbloquearAudios = () => {
    [audioMensagem, audioEntrou, audioSaiu].forEach(audio => {
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
        }).catch(() => {});
    });
};

const SILENT_AUDIO = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";


// =====================================================================
// ESTADO GLOBAL
// =====================================================================
let somAtivado = false;

// Força o estado correto de visibilidade logo no carregamento da página
loginSection.style.display = "none";
chatSection.style.display = "none";

let isLoginMode = true;
let ultimoTimestampCarregado = 0;

let logandoManualmente = false; 
let jaIniciado = false;          
let montandoChat = false; 

const colors = ["cadetblue", "darkgoldenrod", "cornflowerblue", "darkkhaki", "hotpink", "gold"];
const colorFromId = (id) => {
    if (!id) return colors[0];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return colors[Math.abs(h) % colors.length];
};

const user = { 
    id: "", name: "", color: "", 
    isAdmin: false, isModerator: false, isGuardian: false, isHelper: false, isVip: false 
};

const unsubs = {
    messages: null,
    users: null,
    bans: null,
    banCheck: null,
    accountCheck: null, // ⬅️ Adicione esta linha
    myRole: null,
    typing: null,
    pinned: null, // 🔑 FIXAR: Novo listener
};

const cleanupAllListeners = () => {
    Object.keys(unsubs).forEach((k) => {
        if (unsubs[k]) { try { unsubs[k](); } catch (_) {} unsubs[k] = null; }
    });
};

let timeoutPararDigitando = null;
let estaDigitando = false;


// =====================================================================
// FUNÇÕES AUXILIARES
// =====================================================================
// ✅ FUNÇÃO AUXILIAR: Formata o nome para exibição (primeira letra maiúscula)
const formatarNomeExibicao = (nome) => {
    if (!nome) return "Anônimo";
    return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
};

let scrollPending = false;
const scrollScreen = () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        scrollPending = false;
    });
};

const isImageURL = (url) => {
    if (!url || typeof url !== "string") return false;
    const lower = url.toLowerCase();
    if (lower.includes("./emojis/")) return true;
    if (lower.match(/\.(gif|jpe?g|png|webp|bmp)$/)) return true;
    try {
        const host = new URL(url, location.href).hostname.toLowerCase();
        return ["media.giphy.com", "i.giphy.com", "giphy.com", "tenor.com", "media.tenor.com"]
            .some((h) => host === h || host.endsWith("." + h));
    } catch {
        return false;
    }
};

const buildContentNode = (content) => {
    const container = document.createElement("div");
    container.className = "message--content";
    
    if (isImageURL(content)) {
        const img = document.createElement("img");
        img.src = content;
        img.alt = "Imagem";
        img.loading = "lazy";
        container.appendChild(img);
    } else {
        // Divide o texto pelas URLs sem usar innerHTML (100% protegido contra XSS)
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
        const partes = String(content).split(urlRegex);

        partes.forEach((parte) => {
            if (!parte) return;
            if (parte.match(urlRegex)) {
                const a = document.createElement("a");
                a.href = parte.startsWith("http") ? parte : `https://${parte}`;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.textContent = parte;
                container.appendChild(a);
            } else {
                container.appendChild(document.createTextNode(parte));
            }
        });
    }
    return container;
};


// =====================================================================
// CRIAÇÃO DE ELEMENTOS DE MENSAGEM
// =====================================================================
const createMessageElement = (msg, docId) => {
    if (msg.isSystem) {
        const div = document.createElement("div");
        div.classList.add("message--system");

        const texto = document.createElement("span");
        texto.innerHTML = msg.content;
        div.appendChild(texto);

        if (msg.timestamp) {
            const dataHora = document.createElement("span");
            dataHora.className = "message--system-time";
            const d = new Date(msg.timestamp);
            const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
            const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            dataHora.textContent = ` — ${data} às ${hora}`;
            div.appendChild(dataHora);
        }

        div.dataset.id = docId;
        return div;
    }

    const div = document.createElement("div");
    div.dataset.id = docId;

    const isAdminMessage = (msg.userName || "").toLowerCase() === "admin";
    const isBotMessage = (msg.userName || "").toLowerCase() === "bot";
    const isStaffMessage = isAdminMessage || !!msg.isModerator;

    let podeApagar = false;
    if (user.isAdmin) podeApagar = true;
    else if (user.isModerator && !isAdminMessage) podeApagar = true;
    else if (user.isGuardian && !isStaffMessage) podeApagar = true;

    const headerMensagem = document.createElement("div");
    headerMensagem.className = "message--header";

    const imgAvatar = document.createElement("img");
    imgAvatar.className = "message--avatar";
    imgAvatar.src = obterUrlAvatar(msg.userName, {
        isModerator: msg.isModerator,
        isGuardian: msg.isGuardian,
        isHelper: msg.isHelper,
        isVip: msg.isVip
    });
    imgAvatar.alt = "Avatar";
    imgAvatar.loading = "lazy";

    if (isAdminMessage || isBotMessage) {
        if (isAdminMessage) imgAvatar.classList.add("is-admin");
        imgAvatar.style.backgroundColor = "#f1c40f";
        imgAvatar.style.padding = "2px";
        imgAvatar.style.objectFit = "contain";
    } else if (msg.isModerator) {
        imgAvatar.classList.add("is-moderator");
        imgAvatar.style.border = "2px solid #f1c40f";
        imgAvatar.style.boxShadow = "0 0 6px rgba(241, 196, 15, 0.75)";
    } else if (msg.isGuardian) {
        imgAvatar.style.border = "2px solid #3498db";
        imgAvatar.style.boxShadow = "0 0 6px rgba(52, 152, 219, 0.7)";
    } else if (msg.isHelper) {
        imgAvatar.style.border = "2px solid #2ecc71";
        imgAvatar.style.boxShadow = "0 0 6px rgba(46, 204, 113, 0.7)";
    } else if (msg.isVip) {
        imgAvatar.style.border = "2px solid #9b59b6";
        imgAvatar.style.boxShadow = "0 0 6px rgba(155, 89, 182, 0.7)";
    }

    headerMensagem.appendChild(imgAvatar);

    if (msg.userId === user.id) {
        div.classList.add("message--self");
    } else {
        div.classList.add("message--other");
        const sender = document.createElement("span");
        sender.className = "message--sender";
        sender.style.color = msg.userColor || colorFromId(msg.userId);
        const nomeExibido = formatarNomeExibicao(msg.userName) || "Anônimo";
        sender.textContent = isAdminMessage ? `${nomeExibido} 👑` : nomeExibido;
        headerMensagem.appendChild(sender);
    }

    div.appendChild(headerMensagem);
    div.appendChild(buildContentNode(msg.content));

    const actionsContainer = document.createElement("div");
    actionsContainer.className = "message-actions";

    if (podeApagar) {
        const btn = document.createElement("button");
        btn.className = "delete-btn";
        btn.dataset.id = docId;
        btn.textContent = "❌";
        btn.title = "Apagar mensagem";

        btn.addEventListener("click", async () => {
            if (!user.isAdmin && isAdminMessage) {
                return alert("Você não tem permissão para apagar mensagens do Administrador.");
            }
            if (!confirm("Tem certeza que deseja apagar esta mensagem?")) return;
            try { await deleteDoc(doc(db, "mensagens", docId)); }
            catch (e) { console.error("Erro ao apagar:", e); alert("Erro ao apagar. Verifique se você tem permissão."); }
        });
        actionsContainer.appendChild(btn);
    }

    if ((user.isAdmin || user.isModerator || user.isGuardian || user.isHelper) && !msg.isSystem) {
        const btnPin = document.createElement("button");
        btnPin.className = "pin-btn";
        btnPin.title = "Fixar mensagem";
        btnPin.textContent = "📌";
        
        btnPin.addEventListener("click", async () => {
            try {
                await setDoc(doc(db, "mensagem_fixada", "atual"), {
                    messageId: docId,
                    text: msg.content,
                    sender: msg.userName,
                    pinnedBy: user.name
                });
            } catch (e) {
                console.error("Erro ao fixar:", e);
                alert("Erro ao fixar a mensagem.");
            }
        });
        actionsContainer.appendChild(btnPin);
    }

    if (actionsContainer.children.length > 0) {
        div.appendChild(actionsContainer);
    }

    return div;
};

// =====================================================================
// REPRODUÇÃO DE SOM
// =====================================================================
const playSound = (audio, volume = 1.0) => {
    if (!somAtivado) return;
    try {
        audio.volume = volume;
        audio.currentTime = 0;
        audio.play()
            .catch((e) => console.log("Erro ao tocar som:", e))
            .finally(() => { audio.volume = 1.0; });
    } catch (e) {
        console.log("Erro ao tocar som:", e);
    }
};

const atualizarBotaoSom = () => {
    btnSom.style.display = "block";
    if (somAtivado) {
        btnSom.textContent = "🔊";
        btnSom.classList.remove("muted");
        btnSom.title = "Clique para desligar o som";
    } else {
        btnSom.textContent = "🔇";
        btnSom.classList.add("muted");
        btnSom.title = "Clique para ligar o som";
    }
};


// =====================================================================
// RENDERIZAÇÃO INICIAL
// =====================================================================
const renderAllMessagesFromSnapshot = (snapshot) => {
    const frag = document.createDocumentFragment();
    let maiorTs = ultimoTimestampCarregado;
    snapshot.forEach((d) => {
        frag.appendChild(createMessageElement(d.data(), d.id));
        const ts = d.data().timestamp || 0;
        if (ts > maiorTs) maiorTs = ts;
    });
    chatMessages.innerHTML = "";
    chatMessages.appendChild(frag);
    ultimoTimestampCarregado = maiorTs;
    scrollScreen();
};


// =====================================================================
// OUVINTE DE CARGO
// =====================================================================
const listenToMyRole = () => {
    if (unsubs.myRole) unsubs.myRole();

    const myRoleRef = doc(db, "cargos", (user.name || "").toLowerCase());
    unsubs.myRole = onSnapshot(myRoleRef, (docSnap) => {
        const data = docSnap.exists() ? docSnap.data() : {};
        const isMod = !!data.isModerator;
        const isGuard = !!data.isGuardian;
        const isHelp = !!data.isHelper;
        const isVipUser = !!data.isVip;
        const isAdm = !!data.isAdmin || (user.name || "").toLowerCase() === "admin";

        const cargoMudou = (
            user.isModerator !== isMod ||
            user.isGuardian !== isGuard ||
            user.isHelper !== isHelp ||
            user.isVip !== isVipUser ||
            user.isAdmin !== isAdm
        );

        user.isModerator = isMod;
        user.isGuardian = isGuard;
        user.isHelper = isHelp;
        user.isVip = isVipUser;
        user.isAdmin = isAdm;

        if (isAdm) {
            document.body.classList.add("is-admin");
            adminBar.style.display = "block";
        } else {
            document.body.classList.remove("is-admin");
            adminBar.style.display = "none";
        }

        if (cargoMudou) {
            atualizarInterfaceMensagens();
            if (isMod || isGuard || isHelp || isAdm) {
                listenToPinnedMessage();
            }
        }
    });
};


// =====================================================================
// ATUALIZAR INTERFACE EM TEMPO REAL
// =====================================================================
const atualizarInterfaceMensagens = () => {
    const mensagensNaTela = chatMessages.querySelectorAll("div[data-id]");
    
    mensagensNaTela.forEach(div => {
        const msgId = div.dataset.id;
        
        const actionsAntigo = div.querySelector(".message-actions");
        if (actionsAntigo) actionsAntigo.remove();

        const btnPinAntigo = div.querySelector(".pin-btn");
        if (btnPinAntigo) btnPinAntigo.remove();

        const btnApagarAntigo = div.querySelector(".delete-btn");
        if (btnApagarAntigo) btnApagarAntigo.remove();
        
        if (div.classList.contains("message--system")) return;

        const isAdminMsg = div.querySelector(".message--avatar.is-admin") !== null;
        const isStaffMsg = isAdminMsg || div.querySelector(".message--avatar.is-moderator") !== null;

        let podeApagar = false;
        if (user.isAdmin) podeApagar = true;
        else if (user.isModerator && !isAdminMsg) podeApagar = true;
        else if (user.isGuardian && !isStaffMsg) podeApagar = true;

        const actionsContainer = document.createElement("div");
        actionsContainer.className = "message-actions";

        if (podeApagar) {
            const btn = document.createElement("button");
            btn.className = "delete-btn";
            btn.dataset.id = msgId;
            btn.textContent = "❌";
            btn.title = "Apagar mensagem";
            btn.addEventListener("click", async () => {
                if (!user.isAdmin && isAdminMsg) return alert("Sem permissão.");
                if (!confirm("Tem certeza que deseja apagar esta mensagem?")) return;
                try { await deleteDoc(doc(db, "mensagens", msgId)); } catch (e) {}
            });
            actionsContainer.appendChild(btn);
        }

        if (user.isAdmin || user.isModerator || user.isGuardian || user.isHelper) {
            const btnPin = document.createElement("button");
            btnPin.className = "pin-btn";
            btnPin.title = "Fixar mensagem";
            btnPin.textContent = "📌";
            
            btnPin.addEventListener("click", async () => {
                try {
                    const msgDoc = await getDoc(doc(db, "mensagens", msgId));
                    if (msgDoc.exists()) {
                        await setDoc(doc(db, "mensagem_fixada", "atual"), {
                            messageId: msgId,
                            text: msgDoc.data().content,
                            sender: msgDoc.data().userName,
                            pinnedBy: user.name
                        });
                    }
                } catch (e) {
                    console.error("Erro ao fixar:", e);
                }
            });
            actionsContainer.appendChild(btnPin);
        }

        if (actionsContainer.children.length > 0) {
            div.appendChild(actionsContainer);
        }
    });
};


// =====================================================================
// MENSAGEM FIXADA (PIN)
// =====================================================================
// 🔑 FIXAR: Função para escutar a mensagem fixada
const listenToPinnedMessage = () => {
    if (unsubs.pinned) unsubs.pinned();
    
    const pinnedRef = doc(db, "mensagem_fixada", "atual");
    
    unsubs.pinned = onSnapshot(pinnedRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const remetente = formatarNomeExibicao(data.sender);
            
            // Remove o estado de expandido ao carregar uma nova mensagem fixada
            pinnedBar.classList.remove("expanded");

            pinnedText.innerHTML = "";

            const spanRemetente = document.createElement("strong");
            spanRemetente.textContent = `${remetente}: `;
            pinnedText.appendChild(spanRemetente);

            if (isImageURL(data.text)) {
                const img = document.createElement("img");
                img.src = data.text;
                img.alt = "Fixado";
                img.style.height = "24px";
                img.style.verticalAlign = "middle";
                img.style.marginLeft = "5px";
                img.style.borderRadius = "4px";
                pinnedText.appendChild(img);
            } else {
                const textNode = document.createTextNode(data.text);
                pinnedText.appendChild(textNode);
            }

            pinnedBar.style.display = "flex";
        } else {
            pinnedBar.style.display = "none";
            pinnedText.innerHTML = "";
        }
    });
};

// 🔑 EVENTO PARA EXPANDIR / RECOLHER A MENSAGEM FIXADA AO CLICAR NELA
pinnedBar.addEventListener("click", (e) => {
    // Se o clique for no botão de desafixar (X), não faz nada aqui para não conflitar
    if (e.target.closest("#btn-unpin")) return;
    
    // Adiciona ou remove a classe 'expanded'
    pinnedBar.classList.toggle("expanded");
});

// 🔑 FIXAR: Evento para desafixar
btnUnpin.addEventListener("click", async () => {
    if (!user.isAdmin && !user.isModerator && !user.isGuardian && !user.isHelper) {
        return alert("Apenas administradores, moderadores, guardiões e ajudantes podem desafixar.");
    }
    try {
        await deleteDoc(doc(db, "mensagem_fixada", "atual"));
    } catch (e) {
        console.error("Erro ao desafixar:", e);
        alert("Erro ao desafixar.");
    }
});


// =====================================================================
// OUVINTE DE MENSAGENS
// =====================================================================
const listenToMessages = () => {
    if (unsubs.messages) unsubs.messages();
    ultimoTimestampCarregado = 0;

    const q = query(collection(db, "mensagens"), orderBy("timestamp", "asc"), limit(500));

    let primeiroSnapshot = true;
    let resolvePrimeiroSnapshot;
    const primeiroSnapshotPromise = new Promise((resolve) => {
        resolvePrimeiroSnapshot = resolve;
    });

    unsubs.messages = onSnapshot(q, (snapshot) => {
        if (primeiroSnapshot) {
            primeiroSnapshot = false;
            if (snapshot.size > 0) {
                renderAllMessagesFromSnapshot(snapshot);
            }
            resolvePrimeiroSnapshot();
            return;
        }

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const msg = change.doc.data();
                chatMessages.appendChild(createMessageElement(msg, change.doc.id));

                const isNewMessage = (msg.timestamp || 0) > ultimoTimestampCarregado;
                if (isNewMessage) ultimoTimestampCarregado = msg.timestamp;

                if (somAtivado && isNewMessage) {
                    if (msg.isSystem) {
                        if (msg.tipo === "entrou") {
                            playSound(audioEntrou);
                        } 
                        else if (msg.tipo === "saiu") {
                            const nomeDeQuemSaiu = msg.content.replace("🔴 ", "").replace(" saiu", "").trim();
                            const meuNomeFormatado = formatarNomeExibicao(user.name);
                            
                            if (nomeDeQuemSaiu !== meuNomeFormatado) {
                                playSound(audioSaiu);
                            }
                        }
                    } else if (msg.userId !== user.id) {
                        playSound(audioMensagem);
                    }
                }
                scrollScreen();
            } else if (change.type === "removed") {
                const el = chatMessages.querySelector(`[data-id="${change.doc.id}"]`);
                if (el) el.remove();
            }
        });
    });

    return primeiroSnapshotPromise;
};


// =====================================================================
// LISTA DE ONLINE E BANIDOS
// =====================================================================
// Fecha o menu de moderação ao clicar fora ou pressionar ESC
document.addEventListener("click", () => {
    document.querySelectorAll(".user-context-menu").forEach((m) => m.remove());
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        document.querySelectorAll(".user-context-menu").forEach((m) => m.remove());
    }
});

const listenToOnlineUsers = () => {
    if (unsubs.users) unsubs.users();
    const q = query(collection(db, "usuarios_online"));
    
    unsubs.users = onSnapshot(q, (snapshot) => {
        onlineList.innerHTML = "";
        let count = 0;
        const agora = Date.now();
        const TIMEOUT_MS = 60000;

        snapshot.forEach((docSnap) => {
            const u = docSnap.data();

            if (!u.name) return;
            if (u.ultimaAtividade && (agora - u.ultimaAtividade > TIMEOUT_MS)) return;

            count++;
            const li = document.createElement("li");
            const userInfo = document.createElement("div");
            userInfo.classList.add("user-info");

            const nameSpan = document.createElement("span");
            nameSpan.className = "user-name-text";
            nameSpan.textContent = formatarNomeExibicao(u.name);
            userInfo.appendChild(nameSpan);

            if ((u.name || "").toLowerCase() === "admin") {
                userInfo.insertAdjacentHTML("beforeend", `<span class="moderator-badge" title="Administrador" aria-label="Administrador">👑</span>`);
            } else if (u.isModerator) {
                userInfo.insertAdjacentHTML("beforeend", `<span class="moderator-badge" title="Moderador" aria-label="Moderador">🛡️</span>`);
            } else if (u.isGuardian) {
                userInfo.insertAdjacentHTML("beforeend", `<span class="moderator-badge" title="Guardião" aria-label="Guardião">🔰</span>`);
            } else if (u.isHelper) {
                userInfo.insertAdjacentHTML("beforeend", `<span class="moderator-badge" title="Ajudante" aria-label="Ajudante">🌟</span>`);
            } else if (u.isVip) {
                userInfo.insertAdjacentHTML("beforeend", `<span class="moderator-badge" title="VIP" aria-label="VIP">💎</span>`);
            }

            li.appendChild(userInfo);
            li.classList.add("user--online");

            if (user.isAdmin && (u.name || "").toLowerCase() !== "admin") {
                const btnMenu = document.createElement("button");
                btnMenu.textContent = "⋮";
                btnMenu.className = "btn-user-menu";
                btnMenu.title = `Gerenciar ${formatarNomeExibicao(u.name)}`;
                btnMenu.setAttribute("aria-label", btnMenu.title);

                btnMenu.addEventListener("click", (e) => {
                    e.stopPropagation();

                    const menuAberto = document.querySelector(`.user-context-menu[data-target="${docSnap.id}"]`);
                    document.querySelectorAll(".user-context-menu").forEach((m) => m.remove());
                    if (menuAberto) return;

                    const menu = document.createElement("div");
                    menu.className = "user-context-menu";
                    menu.dataset.target = docSnap.id;
                    menu.addEventListener("click", (ev) => ev.stopPropagation());

                    const criarOpcaoCargo = (campo, labelAtivo, labelInativo, valorAtual) => {
                        const btn = document.createElement("button");
                        btn.textContent = valorAtual ? labelAtivo : labelInativo;
                        btn.addEventListener("click", async () => {
                            menu.remove();
                            const acao = valorAtual ? `remover "${labelInativo.slice(2)}" de` : `promover "${u.name}" a ${labelInativo.slice(2)}`;
                            if (!confirm(`Tem certeza que deseja ${acao}?`)) return;
                            try {
                                const novoValor = !valorAtual;
                                await setDoc(doc(db, "cargos", (u.name || "").toLowerCase()), { [campo]: novoValor }, { merge: true });
                                await setDoc(doc(db, "usuarios_online", docSnap.id), { [campo]: novoValor }, { merge: true }).catch(() => {});
                            } catch (err) {
                                alert("Erro ao alterar cargo: " + err.message);
                            }
                        });
                        return btn;
                    };

                    const itemBan = document.createElement("button");
                    itemBan.className = "danger";
                    itemBan.textContent = "🚫 Banir Usuário";
                    itemBan.addEventListener("click", async () => {
                        menu.remove();
                        if (!confirm(`Tem certeza que deseja BANIR "${u.name}"?`)) return;
                        try {
                            await setDoc(doc(db, "banidos", (u.name || "").toLowerCase()), { banido: true });
                            await deleteDoc(doc(db, "usuarios_online", docSnap.id));
                        } catch (err) {
                            console.error("Erro ao banir:", err);
                            alert("Erro ao banir: " + err.message);
                        }
                    });

                    menu.appendChild(criarOpcaoCargo("isModerator", "🛡️ Remover Moderador", "🛡️ Tornar Moderador", !!u.isModerator));
                    menu.appendChild(criarOpcaoCargo("isGuardian", "🔰 Remover Guardião", "🔰 Tornar Guardião", !!u.isGuardian));
                    menu.appendChild(criarOpcaoCargo("isHelper", "🌟 Remover Ajudante", "🌟 Tornar Ajudante", !!u.isHelper));
                    menu.appendChild(criarOpcaoCargo("isVip", "💎 Remover VIP", "💎 Tornar VIP", !!u.isVip));
                    menu.appendChild(itemBan);
                    document.body.appendChild(menu);

                    const rect = btnMenu.getBoundingClientRect();
                    const menuWidth = 190;
                    const menuHeight = 205;
                    const left = Math.min(Math.max(8, rect.left), window.innerWidth - menuWidth - 8);
                    const top = Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8);

                    menu.style.left = `${left}px`;
                    menu.style.top = `${top}px`;
                });

                li.appendChild(btnMenu);
            }

            onlineList.appendChild(li);
        });
        onlineCount.textContent = count;
    });
};

const listenToOwnBanStatus = () => {
    if (unsubs.banCheck) unsubs.banCheck();
    const banCheckRef = doc(db, "banidos", (user.name || "").toLowerCase());
    unsubs.banCheck = onSnapshot(banCheckRef, (docSnap) => {
        if (docSnap.exists()) {
            alert("Você foi banido do chat pelo administrador!");
            btnLogout.click();
        }
    });
};

const listenToBans = () => {
    if (unsubs.bans) unsubs.bans();
    const q = query(collection(db, "banidos"));
    unsubs.bans = onSnapshot(q, (snapshot) => {
        bansList.innerHTML = "";
        if (snapshot.empty) {
            bansList.innerHTML = "<li style='justify-content:center; color:#888;'>Nenhum usuário banido.</li>";
            return;
        }
        snapshot.forEach((docSnap) => {
            const li = document.createElement("li");
            const span = document.createElement("span");
            span.style.textTransform = "capitalize";
            span.textContent = docSnap.id;
            const btn = document.createElement("button");
            btn.className = "btn-unban";
            btn.dataset.id = docSnap.id;
            btn.textContent = "Desbanir";

            btn.addEventListener("click", async () => {
                if (!confirm(`Remover o banimento de "${docSnap.id}"?`)) return;
                try { await deleteDoc(doc(db, "banidos", docSnap.id)); }
                catch (e) { console.error(e); alert("Erro ao desbanir: " + e.message); }
            });

            li.appendChild(span);
            li.appendChild(btn);
            bansList.appendChild(li);
        });
    });
};


// =====================================================================
// AUTENTICAÇÃO E LOGIN
// =====================================================================
toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    formTitle.textContent = isLoginMode ? "Login" : "Cadastro";
    submitBtn.textContent = isLoginMode ? "Entrar" : "Cadastrar";
    toggleMsg.textContent = isLoginMode ? "Não tem conta?" : "Já tem conta?";
    toggleLink.textContent = isLoginMode ? "Cadastre-se" : "Faça Login";

    emailInput.style.display = "block"; 
    forgotPasswordContainer.style.display = isLoginMode ? "block" : "none";
});

const entrarNoChat = async (uid, nome) => {
    if (montandoChat) return;
    montandoChat = true;

    user.id = uid;
    user.name = (nome || "").toLowerCase();
    user.color = colorFromId(uid);

    desbloquearAudios();
    somAtivado = true;
    atualizarBotaoSom();

    const cargoDoc = await getDoc(doc(db, "cargos", user.name));
    const cData = cargoDoc.exists() ? cargoDoc.data() : {};
    const isAdm = !!cData.isAdmin;

    if (user.name === "admin" || isAdm) {
        user.isAdmin = true;
        document.body.classList.add("is-admin");
        adminBar.style.display = "block";
    } else {
        user.isAdmin = false;
        document.body.classList.remove("is-admin");
        adminBar.style.display = "none";
    }
    user.isModerator = !!cData.isModerator;
    user.isGuardian = !!cData.isGuardian;
    user.isHelper = !!cData.isHelper;
    user.isVip = !!cData.isVip;

    if (!user.isAdmin) {
        listenToOwnBanStatus();

        unsubs.accountCheck = onSnapshot(doc(db, "nomes_registrados", user.name), (docSnap) => {
            if (!docSnap.exists() && jaIniciado) {
                alert("Sua conta foi excluída pelo administrador.");
                cleanupChatSession();
            }
        });
    }

    loginSection.style.display = "none";
    chatSection.style.display = "flex";
    btnEditName.style.display = "block";
    btnEditEmail.style.display = "block";

    await setDoc(doc(db, "usuarios_online", user.id), {
        name: user.name,
        color: user.color,
        isModerator: user.isModerator,
        isGuardian: user.isGuardian,
        isHelper: user.isHelper,
        isVip: user.isVip,
        ultimaAtividade: Date.now()
    }, { merge: true });

    const primeiroSnapshotPromise = listenToMessages();
    listenToOnlineUsers();
    listenToMyRole();
    listenToPinnedMessage();
     
    try {
        iniciarJogoDamas(db, user);
    } catch (e) {
        console.error("Erro ao carregar Damas:", e);
    }

    unsubs.typing = ouvirDigitando(db, user.id, (nomes) => {
        const texto = formatarTextoDigitando(nomes);
        if (texto) {
            typingIndicator.textContent = texto;
            typingIndicator.style.display = "block";
        } else {
            typingIndicator.style.display = "none";
            typingIndicator.textContent = "";
        }
    });

    await primeiroSnapshotPromise;

    const chaveEntrada = `chat_entrou_${user.id}`;
    
    if (!sessionStorage.getItem(chaveEntrada)) {
        try {
            await anunciarEntrada(db, user.name);
            sessionStorage.setItem(chaveEntrada, "true");
        } catch (e) {
            console.error("Falha ao anunciar entrada:", e);
        }
    }

    montandoChat = false;
};

const handleLogin = async (name, email, password) => {
    if (!name) return alert("Por favor, digite seu nome de usuário.");
    if (!email) return alert("Por favor, digite seu e-mail.");

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const UID_ADMIN_VERDADEIRO = "J7YAEyln6ENA8v5IqYjkshznFyj2";
    if (name.toLowerCase() === "admin" && uid !== UID_ADMIN_VERDADEIRO) {
        await signOut(auth);
        return alert("Acesso negado. Você não é o administrador.");
    }

    const userRef = doc(db, "usuarios_online", uid);
    const userSnap = await getDoc(userRef);
    let nomeVerdadeiro = name.toLowerCase();

    if (userSnap.exists() && userSnap.data().name) {
        nomeVerdadeiro = userSnap.data().name;
        
        if (name.toLowerCase() !== nomeVerdadeiro) {
            await signOut(auth);
            return alert(`Acesso negado. Esta conta pertence a "${nomeVerdadeiro}".`);
        }
    } else {
        const snapUsuarios = await getDocs(query(collection(db, "usuarios_online")));
        const nomeEmUso = snapUsuarios.docs.some(d => d.data().name && d.data().name.toLowerCase() === name.toLowerCase() && d.id !== uid);
        if (nomeEmUso) {
            await signOut(auth);
            return alert("Este nome de usuário já está em uso por outra conta.");
        }
    }

    await updateProfile(cred.user, { displayName: nomeVerdadeiro });
    await cred.user.reload();
    await cred.user.getIdToken(true); 

    jaIniciado = true;

    await entrarNoChat(uid, nomeVerdadeiro);
};

const handleSignup = async (name, email, password) => {
    if (!name) return alert("Digite um nome de usuário.");
    if (!email) return alert("Por favor, digite um e-mail válido para se cadastrar.");

    const nomeMinusculo = name.trim().toLowerCase();
    if (["admin", "bot", "sistema", "moderador", "guardiao", "ajudante", "vip"].includes(nomeMinusculo)) {
        return alert("Este nome é reservado. Escolha outro.");
    }

    try {
        const nomeRef = doc(db, "nomes_registrados", nomeMinusculo);
        const nomeSnap = await getDoc(nomeRef);
        if (nomeSnap.exists()) {
            return alert("❌ Este nome de usuário já está em uso! Escolha outro.");
        }

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: nomeMinusculo });

        await setDoc(nomeRef, { uid: cred.user.uid });

        await signOut(auth);
        alert("Cadastro realizado com sucesso! Faça login.");
        toggleLink.click();
    } catch (error) {
        if (error.code === "auth/email-already-in-use") alert("Este e-mail já está em uso!");
        else if (error.code === "auth/weak-password") alert("A senha precisa ter pelo menos 6 caracteres.");
        else alert("Erro ao cadastrar: " + error.message);
    }
};

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    const name = usernameInput.value.trim();
    const password = passwordInput.value;
    const email = emailInput.value.trim();

    const nomesReservados = ["bot", "sistema", "moderador", "guardiao", "ajudante", "vip"];
    if (nomesReservados.includes(name.toLowerCase())) {
        alert("❌ Este nome é reservado pelo sistema. Escolha outro apelido!");
        submitBtn.disabled = false;
        return;
    }

    logandoManualmente = true; 
    try {
        if (isLoginMode) await handleLogin(name, email, password);
        else await handleSignup(name, email, password);
    } catch (error) {
        if (error.code === "auth/email-already-in-use") alert("Este e-mail já está em uso!");
        else if (error.code === "auth/invalid-credential") alert("E-mail ou senha incorretos!");
        else if (error.code === "auth/weak-password") alert("A senha precisa ter pelo menos 6 caracteres!");
        else alert("Erro: " + error.message);
    } finally {
        submitBtn.disabled = false;
        logandoManualmente = false; 
    }
});

onAuthStateChanged(auth, async (firebaseUser) => {
    if (logandoManualmente) return;
    if (jaIniciado) return;

    if (!firebaseUser) {
        loginSection.style.display = "block";
        chatSection.style.display = "none";
        return;
    }

    try {
        const uid = firebaseUser.uid;

        let nome = firebaseUser.displayName;
        if (!nome) {
            const snap = await getDoc(doc(db, "usuarios_online", uid));
            if (snap.exists() && snap.data().name) {
                nome = snap.data().name;
            }
        }

        if (!nome) {
            await signOut(auth);
            loginSection.style.display = "block";
            chatSection.style.display = "none";
            return;
        }

        const banCheck = await getDoc(doc(db, "banidos", nome.toLowerCase()));
        if (banCheck.exists()) {
            alert("Você foi banido e não pode acessar o chat.");
            await signOut(auth);
            loginSection.style.display = "block";
            chatSection.style.display = "none";
            return;
        }

        const UID_ADMIN_VERDADEIRO = "J7YAEyln6ENA8v5IqYjkshznFyj2";
        if (nome.toLowerCase() === "admin" && uid !== UID_ADMIN_VERDADEIRO) {
            await signOut(auth);
            loginSection.style.display = "block";
            chatSection.style.display = "none";
            return;
        }

        const nomesReservados = ["bot", "sistema", "moderador", "guardiao", "ajudante", "vip"];
        if (nomesReservados.includes(nome.toLowerCase())) {
            alert("❌ Este nome é reservado pelo sistema. Escolha outro apelido!");
            await signOut(auth);
            loginSection.style.display = "block";
            chatSection.style.display = "none";
            return;
        }

        const nomeRegRef = doc(db, "nomes_registrados", nome.toLowerCase());
        const nomeRegSnap = await getDoc(nomeRegRef);

        if (!nomeRegSnap.exists()) {
            await setDoc(nomeRegRef, { uid: uid });
        } else if (nomeRegSnap.data().uid !== uid) {
            alert("❌ Este nome já pertence a outro usuário!");
            await signOut(auth);
            loginSection.style.display = "block";
            chatSection.style.display = "none";
            return;
        }

        jaIniciado = true;
        await entrarNoChat(uid, nome);
    } catch (e) {
        console.error("Erro ao restaurar sessão:", e);
        loginSection.style.display = "block";
        chatSection.style.display = "none";
    }
});


// =====================================================================
// MODAL DE BANIDOS
// =====================================================================
const abrirModalBans = () => {
    bansModal.classList.add("show");
    listenToBans();
};
const fecharModalBans = () => {
    bansModal.classList.remove("show");
    if (unsubs.bans) { unsubs.bans(); unsubs.bans = null; }
};

btnManageBans.addEventListener("click", abrirModalBans);
closeBansModal.addEventListener("click", fecharModalBans);
bansModal.addEventListener("click", (e) => {
    if (e.target === bansModal) fecharModalBans();
});


// =====================================================================
// OUTRAS FUNÇÕES
// =====================================================================
forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("Digite seu E-MAIL cadastrado para receber o link de recuperação:");
    if (!email) return;
    try {
        await sendPasswordResetEmail(auth, email);
        alert("Link de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (error) {
        alert("Erro ao enviar e-mail: " + error.message);
    }
});

btnEditName.addEventListener("click", async () => {
    const novoNome = prompt("Digite o seu novo nome de exibição:", user.name);
    if (!novoNome || !novoNome.trim() || novoNome.trim() === user.name) return;
    const nomeFormatado = novoNome.trim().toLowerCase();
    if (["admin", "bot", "sistema", "moderador", "guardiao", "ajudante", "vip"].includes(nomeFormatado)) {
        return alert("Este nome é reservado.");
    }
    const novoNomeRef = doc(db, "nomes_registrados", nomeFormatado);
    const novoNomeSnap = await getDoc(novoNomeRef);
    if (novoNomeSnap.exists() && novoNomeSnap.data().uid !== user.id) {
        return alert("❌ Este nome já está em uso por outro usuário!");
    }
    try {
        const nomeAntigo = user.name.toLowerCase();
        if (nomeAntigo !== nomeFormatado) {
            if (unsubs.accountCheck) {
                unsubs.accountCheck();
                unsubs.accountCheck = null;
            }
            await deleteDoc(doc(db, "nomes_registrados", nomeAntigo));
            await setDoc(novoNomeRef, { uid: user.id });
            if (!user.isAdmin) {
                unsubs.accountCheck = onSnapshot(doc(db, "nomes_registrados", nomeFormatado), (docSnap) => {
                    if (!docSnap.exists() && jaIniciado) {
                        alert("Sua conta foi excluída pelo administrador.");
                        cleanupChatSession();
                    }
                });
            }
        }
        user.name = nomeFormatado;
        await updateProfile(auth.currentUser, { displayName: user.name });
        await auth.currentUser.reload();
        if (!user.isAdmin) listenToOwnBanStatus();
        await setDoc(doc(db, "usuarios_online", user.id), { name: user.name, color: user.color }, { merge: true });
        const q = query(collection(db, "mensagens"), where("userId", "==", user.id));
        const snap = await getDocs(q);
        const MAX = 500;
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += MAX) {
            const batch = writeBatch(db);
            docs.slice(i, i + MAX).forEach((d) => batch.update(d.ref, { userName: user.name }));
            await batch.commit();
        }
        alert("Nome atualizado com sucesso!");
    } catch (e) {
        alert("Erro ao atualizar nome: " + e.message);
    }
});

btnEditEmail.addEventListener("click", async () => {
    const novoEmail = prompt("Digite o NOVO e-mail para sua conta:", auth.currentUser?.email || "");
    if (!novoEmail || !novoEmail.includes("@")) return;
    try {
        await verifyBeforeUpdateEmail(auth.currentUser, novoEmail);
        alert("Um link de confirmação foi enviado para o novo e-mail. Clique nele para concluir a alteração.");
    } catch (error) {
        if (error.code === "auth/requires-recent-login") {
            alert("Por segurança, faça login novamente antes de alterar o e-mail.");
        } else {
            alert("Erro: " + error.message);
        }
    }
});

const cleanupChatSession = async () => {
    cleanupAllListeners();
    jaIniciado = false;
    logandoManualmente = false;
    montandoChat = false;
    if (user.id) {
        sessionStorage.removeItem("chat_entrou_" + user.id);
    }
    estaDigitando = false;
    clearTimeout(timeoutPararDigitando);
    typingIndicator.style.display = "none";
    typingIndicator.textContent = "";
    await signOut(auth);
    user.id = ""; user.name = ""; user.color = "";
    user.isAdmin = false; user.isModerator = false;
    user.isGuardian = false; user.isHelper = false; user.isVip = false;
    document.body.classList.remove("is-admin");
    chatMessages.innerHTML = "";
    onlineList.innerHTML = "";
    onlineCount.textContent = "0";
    adminBar.style.display = "none";
    chatSection.style.display = "none";
    loginSection.style.display = "block";
    btnEditName.style.display = "none";
    btnEditEmail.style.display = "none";
    usernameInput.value = ""; passwordInput.value = ""; emailInput.value = "";
    btnSom.style.display = "none";
    btnSom.classList.remove("muted");
    somAtivado = false;
    ultimoTimestampCarregado = 0;
    if (pinnedBar) pinnedBar.style.display = "none";
    if (!isLoginMode) toggleLink.click();
};

btnLogout.addEventListener("click", async () => {
    try {
        if (user.id) {
            estaDigitando = false;
            clearTimeout(timeoutPararDigitando);
            await pararDeDigitar(db, user.id).catch(() => {});
            try { await anunciarSaida(db, user.name); } catch (e) { console.error(e); }
            await deleteDoc(doc(db, "usuarios_online", user.id)).catch(() => {});
        }
    } catch (e) {
        console.error("Erro no logout:", e);
    } finally {
        setTimeout(() => {
            cleanupChatSession();
        }, 1000);
    }
});

const sendMessageToDb = async (content) => {
    if (!user.id || !content) return;
    try {
        const banCheck = await getDoc(doc(db, "banidos", user.name));
        if (banCheck.exists()) {
            alert("Você está banido e não pode enviar mensagens!");
            btnLogout.click();
            return;
        }
        await addDoc(collection(db, "mensagens"), {
            userId: user.id,
            userName: user.name,
            userColor: user.color,
            isModerator: user.isModerator,
            isGuardian: user.isGuardian,
            isHelper: user.isHelper,
            isVip: user.isVip,
            content,
            timestamp: Date.now()
        });
        if (somAtivado) playSound(audioMensagem);
    } catch (e) {
        console.error("Erro ao enviar:", e);
        alert("Erro ao enviar mensagem: " + e.message);
    }
};

chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessageToDb(chatInput.value.trim());
    chatInput.value = "";
    if (window.innerWidth <= 600) {
        chatInput.blur();
    }
    estaDigitando = false;
    clearTimeout(timeoutPararDigitando);
    pararDeDigitar(db, user.id).catch(() => {});
});

const enviarDigitandoDebounced = criarDebounce(() => {
    if (!user.id) return;
    marcarComoDigitando(db, user).catch(() => {});
}, 1000);

chatInput.addEventListener("input", () => {
    if (!user.id) return;
    estaDigitando = true;
    enviarDigitandoDebounced();
    clearTimeout(timeoutPararDigitando);
    timeoutPararDigitando = setTimeout(() => {
        estaDigitando = false;
        pararDeDigitar(db, user.id).catch(() => {});
    }, 3000);
});

stickersBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".sticker-btn");
    if (btn) sendMessageToDb(btn.dataset.emoji);
});

btnGifKeyboard.addEventListener("click", () => {
    stickersBar.classList.toggle("show");
    btnGifKeyboard.classList.toggle("active");
    if (stickersBar.classList.contains("show")) {
        chatInput.blur();
    }
});

btnClearAll.addEventListener("click", async () => {
    if (!confirm("Apagar TODAS as mensagens?")) return;
    try {
        const snap = await getDocs(query(collection(db, "mensagens")));
        const MAX = 500;
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += MAX) {
            const batch = writeBatch(db);
            docs.slice(i, i + MAX).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    } catch (e) { console.error(e); alert("Erro ao limpar: " + e.message); }
});

btnSom.addEventListener("click", () => {
    if (somAtivado) {
        somAtivado = false;
        audioMensagem.pause();
        audioMensagem.currentTime = 0;
        audioEntrou.pause();
        audioEntrou.currentTime = 0;
        audioSaiu.pause();
        audioSaiu.currentTime = 0;
        atualizarBotaoSom();
    } else {
        desbloquearAudios();
        somAtivado = true;
        atualizarBotaoSom();
        playSound(audioMensagem, 0.5);
    }
});

window.addEventListener("beforeunload", () => {
    if (!user.id) return;
    deleteDoc(doc(db, "usuarios_online", user.id)).catch(() => {});
});

setInterval(async () => {
    if (!user.id || !auth.currentUser) return;
    try {
        await auth.currentUser.reload();
        await setDoc(doc(db, "usuarios_online", user.id), {
            name: user.name,
            color: user.color,
            isModerator: user.isModerator,
            isGuardian: user.isGuardian,
            isHelper: user.isHelper,
            isVip: user.isVip,
            ultimaAtividade: Date.now()
        }, { merge: true });
    } catch (e) {
        if (e.code === "auth/user-not-found" || e.code === "auth/user-token-expired" || e.code === "auth/user-disabled") {
            alert("Sua conta foi excluída ou desativada.");
            cleanupChatSession();
        }
    }
}, 15000);