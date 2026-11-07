// ================= CONFIGURAÇÃO DO FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    sendPasswordResetEmail, verifyBeforeUpdateEmail, updateProfile,
    onAuthStateChanged   // 🔑 NOVO: necessário para restaurar sessão ao recarregar
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

// ================= ELEMENTOS DO DOM =================
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



// ================= INDICADOR DE DIGITAÇÃO (UI) =================
const typingIndicator = document.createElement("div");
typingIndicator.className = "typing-indicator";
typingIndicator.style.display = "none";
chatForm.parentNode.insertBefore(typingIndicator, chatForm);

// ================= ÁUDIOS =================
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

let somAtivado = false;

// Força o estado correto de visibilidade logo no carregamento da página
loginSection.style.display = "none";
chatSection.style.display = "none";

// ✅ FUNÇÃO AUXILIAR: Formata o nome para exibição (primeira letra maiúscula)
const formatarNomeExibicao = (nome) => {
    if (!nome) return "Anônimo";
    return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
};

const colors = ["cadetblue", "darkgoldenrod", "cornflowerblue", "darkkhaki", "hotpink", "gold"];
const colorFromId = (id) => {
    if (!id) return colors[0];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return colors[Math.abs(h) % colors.length];
};

const user = { id: "", name: "", color: "", isAdmin: false, isModerator: false };

let isLoginMode = true;
let ultimoTimestampCarregado = 0;

let logandoManualmente = false; 
let jaIniciado = false;          
let montandoChat = false; 

const unsubs = {
    messages: null,
    users: null,
    bans: null,
    banCheck: null,
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

// ================= FUNÇÕES AUXILIARES =================
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
        container.textContent = content;
    }
    return container;
};

const createMessageElement = (msg, docId) => {
    if (msg.isSystem) {
        const div = document.createElement("div");
        div.classList.add("message--system");

        const texto = document.createElement("span");
        texto.textContent = msg.content;
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
    let podeApagar = false;
    if (user.isAdmin) podeApagar = true;
    else if (user.isModerator && !isAdminMessage) podeApagar = true;

    const headerMensagem = document.createElement("div");
    headerMensagem.className = "message--header";

    const imgAvatar = document.createElement("img");
    imgAvatar.className = "message--avatar";
    imgAvatar.src = obterUrlAvatar(msg.userName, msg.isModerator);
    imgAvatar.alt = "Avatar";
    imgAvatar.loading = "lazy";

    if (msg.userName && msg.userName.toLowerCase() === "admin") {
        imgAvatar.classList.add("is-admin");
        imgAvatar.style.backgroundColor = "#f1c40f";
        imgAvatar.style.padding = "2px";
        imgAvatar.style.objectFit = "contain";
    }
    else if (msg.isModerator) {
        imgAvatar.classList.add("is-moderator");
        imgAvatar.style.backgroundColor = "#f1c40f"; 
        imgAvatar.style.padding = "2px";
        imgAvatar.style.objectFit = "contain";
    }

    headerMensagem.appendChild(imgAvatar);

    if (msg.userId === user.id) {
        div.classList.add("message--self");
    } else {
        div.classList.add("message--other");
        const sender = document.createElement("span");
        sender.className = "message--sender";
        sender.style.color = msg.userColor || colorFromId(msg.userId);
        sender.textContent = formatarNomeExibicao(msg.userName) || "Anônimo";
        headerMensagem.appendChild(sender);
    }

    div.appendChild(headerMensagem);
    div.appendChild(buildContentNode(msg.content));

    if (podeApagar) {
        const btn = document.createElement("button");
        btn.className = "delete-btn";
        btn.dataset.id = docId;
        btn.textContent = "[Apagar]";
        btn.addEventListener("click", async () => {
            if (!user.isAdmin && isAdminMessage) {
                return alert("Você não tem permissão para apagar mensagens do Administrador.");
            }
            try { await deleteDoc(doc(db, "mensagens", docId)); }
            catch (e) { console.error("Erro ao apagar:", e); alert("Erro ao apagar. Verifique se você tem permissão."); }
        });
        div.appendChild(btn);
    }

    // 🔑 FIXAR: Botão de Fixar Mensagem
    if ((user.isAdmin || user.isModerator) && !msg.isSystem) {
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
        div.appendChild(btnPin);
    }

    return div;
};

// ================= REPRODUÇÃO DE SOM =================
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
        btnSom.textContent = "🔊 Som Ligado";
        btnSom.classList.remove("muted");
        btnSom.title = "Clique para desligar o som";
    } else {
        btnSom.textContent = "🔇 Som Desligado";
        btnSom.classList.add("muted");
        btnSom.title = "Clique para ligar o som";
    }
};

// ================= RENDERIZAÇÃO INICIAL =================
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

// ================= OUVINTE DE CARGO =================
const listenToMyRole = () => {
    if (unsubs.myRole) unsubs.myRole();

    const myRoleRef = doc(db, "cargos", (user.name || "").toLowerCase());
    unsubs.myRole = onSnapshot(myRoleRef, (docSnap) => {
        const isMod = docSnap.exists() && !!docSnap.data().isModerator;
        const isAdm = docSnap.exists() && !!docSnap.data().isAdmin;

        // 🔑 Verifica se o cargo realmente mudou em relação ao que estava salvo
        const cargoMudou = (user.isModerator !== isMod) || (user.isAdmin !== (isAdm || (user.name || "").toLowerCase() === "admin"));

        user.isModerator = isMod;

        if (isAdm || (user.name || "").toLowerCase() === "admin") {
            user.isAdmin = true;
            document.body.classList.add("is-admin");
            adminBar.style.display = "block";
        } else {
            user.isAdmin = false;
            document.body.classList.remove("is-admin");
            adminBar.style.display = "none";
        }

        // 🔑 NOVO: Se o cargo mudou, atualiza a tela na hora!
        if (cargoMudou) {
            // Atualiza os botões das mensagens já na tela (Fixar e Apagar)
            atualizarInterfaceMensagens();
            
            // Se o usuário virou moderador, já ativa a escuta da barra de fixados
            if (isMod || user.isAdmin) {
                listenToPinnedMessage();
            }
        }
    });
};

// ================= ATUALIZAR INTERFACE EM TEMPO REAL =================
const atualizarInterfaceMensagens = () => {
    // Pega todas as mensagens que estão na tela
    const mensagensNaTela = chatMessages.querySelectorAll("div[data-id]");
    
    mensagensNaTela.forEach(div => {
        const msgId = div.dataset.id;
        
        // Remove o botão de fixar antigo (se existir)
        const btnPinAntigo = div.querySelector(".pin-btn");
        if (btnPinAntigo) btnPinAntigo.remove();

        // Remove o botão de apagar antigo (se existir)
        const btnApagarAntigo = div.querySelector(".delete-btn");
        if (btnApagarAntigo) btnApagarAntigo.remove();
        
        // Se for mensagem de sistema, ignora
        if (div.classList.contains("message--system")) return;

        // Recria o botão de apagar (se o usuário tiver permissão agora)
        // (Precisamos saber de quem é a mensagem)
        const isAdminMsg = div.querySelector(".message--avatar.is-admin") !== null;
        let podeApagar = false;
        if (user.isAdmin) podeApagar = true;
        else if (user.isModerator && !isAdminMsg) podeApagar = true;

        if (podeApagar) {
            const btn = document.createElement("button");
            btn.className = "delete-btn";
            btn.dataset.id = msgId;
            btn.textContent = "[Apagar]";
            btn.addEventListener("click", async () => {
                if (!user.isAdmin && isAdminMsg) return alert("Sem permissão.");
                try { await deleteDoc(doc(db, "mensagens", msgId)); } catch (e) {}
            });
            div.appendChild(btn);
        }

        // Recria o botão de fixar (se o usuário tiver permissão agora)
        if (user.isAdmin || user.isModerator) {
            const btnPin = document.createElement("button");
            btnPin.className = "pin-btn";
            btnPin.title = "Fixar mensagem";
            btnPin.textContent = "📌";
            
            btnPin.addEventListener("click", async () => {
                try {
                    // Precisamos pegar o conteúdo da mensagem no Firebase
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
            div.appendChild(btnPin);
        }
    });
};

// 🔑 FIXAR: Função para escutar a mensagem fixada
const listenToPinnedMessage = () => {
    if (unsubs.pinned) unsubs.pinned();
    
    const pinnedRef = doc(db, "mensagem_fixada", "atual");
    
    unsubs.pinned = onSnapshot(pinnedRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const remetente = formatarNomeExibicao(data.sender);
            
            // Limpa o conteúdo anterior
            pinnedText.innerHTML = "";

            // Cria o span do remetente
            const spanRemetente = document.createElement("strong");
            spanRemetente.textContent = `${remetente}: `;
            pinnedText.appendChild(spanRemetente);

            // Verifica se o conteúdo é uma imagem (usando a mesma função que o chat usa)
            if (isImageURL(data.text)) {
                const img = document.createElement("img");
                img.src = data.text;
                img.alt = "Fixado";
                // Estilo para a imagem ficar pequena e alinhada na barra
                img.style.height = "24px";
                img.style.verticalAlign = "middle";
                img.style.marginLeft = "5px";
                img.style.borderRadius = "4px";
                pinnedText.appendChild(img);
            } else {
                // Se for texto normal, adiciona o texto
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

// 🔑 FIXAR: Evento para desafixar
btnUnpin.addEventListener("click", async () => {
    if (!user.isAdmin && !user.isModerator) {
        return alert("Apenas administradores e moderadores podem desafixar.");
    }
    try {
        await deleteDoc(doc(db, "mensagem_fixada", "atual"));
    } catch (e) {
        console.error("Erro ao desafixar:", e);
        alert("Erro ao desafixar.");
    }
});

// ================= OUVINTE DE MENSAGENS =================
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

// ================= LISTA DE ONLINE E BANIDOS =================
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

            let badge = u.isModerator ? ` <span class="moderator-badge" aria-label="Moderador">🛡️</span>` : "";
            userInfo.textContent = formatarNomeExibicao(u.name);
            if (badge) userInfo.insertAdjacentHTML("beforeend", badge);

            li.appendChild(userInfo);
            li.classList.add("user--online");

            if (user.isAdmin && (u.name || "").toLowerCase() !== "admin") {
                const btnModerateUser = document.createElement("button");
                btnModerateUser.textContent = "🛡️";
                btnModerateUser.classList.add("btn-moderate-user");
                btnModerateUser.title = u.isModerator ? "Remover Moderador" : "Tornar Moderador";
                btnModerateUser.setAttribute("aria-label", btnModerateUser.title);

                btnModerateUser.addEventListener("click", async () => {
                    const acao = u.isModerator ? "remover o cargo de moderador de" : "tornar moderador";
                    if (!confirm(`Tem certeza que deseja ${acao} "${u.name}"?`)) return;
                    try {
                        await setDoc(doc(db, "cargos", (u.name || "").toLowerCase()), { isModerator: !u.isModerator }, { merge: true });
                        try {
                            await setDoc(doc(db, "usuarios_online", docSnap.id), { isModerator: !u.isModerator }, { merge: true });
                        } catch (err) {
                            console.log("Aviso: Cargo salvo, mas a lista online não pôde ser atualizada.");
                        }
                    } catch (e) { 
                        console.error("Erro ao moderar:", e); 
                        alert("Erro ao moderar: " + e.message); 
                    }
                });
                li.appendChild(btnModerateUser);

                const btnDeleteUser = document.createElement("button");
                btnDeleteUser.textContent = "✖";
                btnDeleteUser.classList.add("btn-delete-user");
                btnDeleteUser.setAttribute("aria-label", "Banir usuário");
                btnDeleteUser.addEventListener("click", async () => {
                    if (!confirm(`Tem certeza que deseja BANIR "${u.name}"?`)) return;
                    try {
                        await setDoc(doc(db, "banidos", (u.name || "").toLowerCase()), { banido: true });
                        await deleteDoc(doc(db, "usuarios_online", docSnap.id));
                    } catch (e) { console.error("Erro ao banir:", e); alert("Erro ao banir: " + e.message); }
                });
                li.appendChild(btnDeleteUser);
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

// ================= AUTENTICAÇÃO E LOGIN =================

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
    const isAdm = cargoDoc.exists() && cargoDoc.data().isAdmin;

    if (user.name === "admin" || isAdm) {
        user.isAdmin = true;
        document.body.classList.add("is-admin");
        adminBar.style.display = "block";
    } else {
        user.isAdmin = false;
        document.body.classList.remove("is-admin");
        adminBar.style.display = "none";
    }
    user.isModerator = !!(cargoDoc.exists() && cargoDoc.data().isModerator);

    loginSection.style.display = "none";
    chatSection.style.display = "flex";
    btnEditName.style.display = "block";
    btnEditEmail.style.display = "block";

    await setDoc(doc(db, "usuarios_online", user.id), {
        name: user.name,
        color: user.color,
        isModerator: user.isModerator,
        ultimaAtividade: Date.now()
    }, { merge: true });

    const primeiroSnapshotPromise = listenToMessages();
    listenToOnlineUsers();
    listenToMyRole();
    listenToPinnedMessage(); // 🔑 FIXAR: Chamada do listener aqui

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

    if (!user.isAdmin) listenToOwnBanStatus();

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
    if (name.toLowerCase() === "admin") {
        return alert("Este nome é reservado. Escolha outro.");
    }

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.toLowerCase() });
        
        await signOut(auth);

        alert("Cadastro realizado com sucesso! Faça login.");
        toggleLink.click();
    } catch (error) {
        if (error.code === "auth/email-already-in-use") alert("Este e-mail já está em uso!");
        else if (error.code === "auth/weak-password") alert("A senha precisa ter pelo menos 6 caracteres!");
        else alert("Erro ao cadastrar: " + error.message);
    }
};

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    const name = usernameInput.value.trim();
    const password = passwordInput.value;
    const email = emailInput.value.trim();

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

        jaIniciado = true;
        await entrarNoChat(uid, nome);
    } catch (e) {
        console.error("Erro ao restaurar sessão:", e);
        loginSection.style.display = "block";
        chatSection.style.display = "none";
    }
});

// ================= MODAL DE BANIDOS =================
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

// ================= OUTRAS FUNÇÕES =================
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

    if (nomeFormatado === "admin") {
        return alert("Este nome é reservado.");
    }

    try {
        user.name = nomeFormatado;
        await updateProfile(auth.currentUser, { displayName: user.name });
        await auth.currentUser.reload();

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
        sessionStorage.removeItem(`chat_entrou_${user.id}`);
    }

    estaDigitando = false;
    clearTimeout(timeoutPararDigitando);
    typingIndicator.style.display = "none";
    typingIndicator.textContent = "";

    await signOut(auth);

    user.id = ""; user.name = ""; user.color = "";
    user.isAdmin = false; user.isModerator = false;
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

    // 🔑 FIXAR: Esconde a barra de fixados ao deslogar
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

setInterval(() => {
    if (!user.id) return;
    setDoc(doc(db, "usuarios_online", user.id), { 
        name: user.name,
        color: user.color,
        isModerator: user.isModerator,
        ultimaAtividade: Date.now() 
    }, { merge: true }).catch(() => {});
}, 15000);