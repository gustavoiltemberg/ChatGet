// ================= CONFIGURAÇÃO DO FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    sendPasswordResetEmail, verifyBeforeUpdateEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDocs,
    getDoc, writeBatch, setDoc, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ================= IMPORTS LOCAIS =================
import { 
    carregarMensagensDoCache, 
    adicionarMensagemAoCache, 
    removerMensagemDoCache,
    limparCache 
} from "./storage.js";

import { 
    marcarComoDigitando, 
    pararDeDigitar, 
    ouvirDigitando, 
    formatarTextoDigitando,
    criarDebounce 
} from "./typing.js";

import { 
    inicializarTema, 
    configurarBotaoTema 
} from "./theme.js";

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

// ================= TEMA (CLARO/ESCURO) =================
// 1. Aplica o tema salvo ao carregar a página (antes de qualquer outra coisa)
inicializarTema();

// 2. Cria o botão de tema dinamicamente (sem precisar mexer no HTML)
const btnTema = document.createElement("button");
btnTema.id = "btn-tema";
btnTema.className = "btn-logout"; // Reusa o estilo visual do botão de logout
btnTema.style.marginRight = "5px";

// 3. Insere o botão antes do botão "Sair" no header
btnLogout.parentNode.insertBefore(btnTema, btnLogout);

// 4. Configura o comportamento (alternar + atualizar texto)
configurarBotaoTema(btnTema);

// ================= INDICADOR DE DIGITAÇÃO (UI) =================
// Cria o elemento dinamicamente e insere antes do form de envio.
const typingIndicator = document.createElement("div");
typingIndicator.className = "typing-indicator";
typingIndicator.style.display = "none";
chatForm.parentNode.insertBefore(typingIndicator, chatForm);

// ================= ÁUDIOS =================
const audioEntrou = new Audio("./sounds/entrou.mp3");
const audioSaiu = new Audio("./sounds/saiu.mp3");
const audioMensagem = new Audio("./sounds/mensagem.mp3");
audioEntrou.volume = 1.0;
audioSaiu.volume = 1.0;
audioMensagem.volume = 1.0;

// Áudio silencioso (base64) para desbloquear o contexto de áudio do navegador
const SILENT_AUDIO = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

// Estado do som — começa DESATIVADO
let somAtivado = false;

const colors = ["cadetblue", "darkgoldenrod", "cornflowerblue", "darkkhaki", "hotpink", "gold"];
const user = { id: "", name: "", color: "", isAdmin: false, isModerator: false };

let isLoginMode = true;
let unsubscribeMessages = null;
let unsubscribeUsers = null;
let unsubscribeBans = null;
let unsubscribeBanCheck = null;
let unsubscribeMyRole = null;
let ultimoTimestampCarregado = 0;

// Controle do indicador de digitação
let unsubscribeTyping = null;
let timeoutPararDigitando = null;
let estaDigitando = false;

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

const formatMessageContent = (content) => isImageURL(content) ? `<img src="${content}" alt="Imagem" />` : content;

const createMessageElement = (msg, docId) => {
    if (msg.isSystem) {
        const div = document.createElement("div");
        div.classList.add("message--system");
        div.innerHTML = msg.content;
        div.dataset.id = docId;
        return div;
    }

    const div = document.createElement("div");
    div.dataset.id = docId; 
    
    const isAdmin = user.isAdmin;
    const isMod = user.isModerator;
    const isAdminMessage = msg.userName.toLowerCase() === "admin";

    let btnDelete = "";
    if (isAdmin || (isMod && !isAdminMessage)) {
        btnDelete = `<button class="delete-btn" data-id="${docId}">[Apagar]</button>`;
    }
    
    const formattedContent = formatMessageContent(msg.content);

    if (msg.userId === user.id) {
        div.classList.add("message--self");
        div.innerHTML = `<div class="message--content">${formattedContent}</div> ${btnDelete}`;
    } else {
        div.classList.add("message--other");
        div.innerHTML = `<span class="message--sender" style="color: ${msg.userColor}">${msg.userName}</span><div class="message--content">${formattedContent}</div> ${btnDelete}`;
    }

    if (btnDelete) {
        const btn = div.querySelector('.delete-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                if (!isAdmin && isAdminMessage) {
                    return alert("Você não tem permissão para apagar mensagens do Administrador.");
                }
                await deleteDoc(doc(db, "mensagens", docId)); 
            });
        }
    }
    return div;
};

// ================= REPRODUÇÃO DE SOM =================
/**
 * Toca um áudio de forma segura, reiniciando o tempo.
 * Só toca se o som estiver ativado.
 */
const playSound = (audio) => {
    if (!somAtivado) return;
    try {
        audio.currentTime = 0;
        audio.play().catch((e) => console.log("Erro ao tocar som:", e));
    } catch (e) {
        console.log("Erro ao tocar som:", e);
    }
};

// ================= BOTÃO DE SOM =================
/**
 * Atualiza o texto, a classe e o título do botão de som conforme o estado atual.
 * - somAtivado = true  → "🔊 Som Ligado"  (verde, sem animação)
 * - somAtivado = false → "🔇 Som Desligado" (vermelho, com pulso)
 */
const atualizarBotaoSom = () => {
    btnSom.style.display = "block";
    if (somAtivado) {
        btnSom.innerText = "🔊 Som Ligado";
        btnSom.classList.remove("muted");
        btnSom.title = "Clique para desligar o som";
    } else {
        btnSom.innerText = "🔇 Som Desligado";
        btnSom.classList.add("muted");
        btnSom.title = "Clique para ligar o som";
    }
};

// ================= OUVINTE DE CARGO =================
const listenToMyRole = () => {
    if (unsubscribeMyRole) unsubscribeMyRole();
    
    const myRoleRef = doc(db, "cargos", user.name.toLowerCase());
    
    unsubscribeMyRole = onSnapshot(myRoleRef, (docSnap) => {
        const isMod = docSnap.exists() && docSnap.data().isModerator;
        
        if (user.isModerator !== isMod) {
            user.isModerator = isMod;
            
            const q = query(collection(db, "mensagens"), orderBy("timestamp", "asc"), limit(100));
            getDocs(q).then((snapshot) => {
                chatMessages.innerHTML = "";
                snapshot.forEach((docSnap) => {
                    chatMessages.appendChild(createMessageElement(docSnap.data(), docSnap.id));
                });
                scrollScreen();
            });
        }
    });
};

// ================= OUVINTE DE MENSAGENS E SONS =================
const listenToMessages = () => {
    if (unsubscribeMessages) unsubscribeMessages();

    // Reset do timestamp ao recriar o listener
    ultimoTimestampCarregado = 0;

    // ===== CACHE LOCAL: CARREGA INSTANTANEAMENTE ANTES DO FIRESTORE =====
    const cacheLocal = carregarMensagensDoCache();
    if (cacheLocal.length > 0 && chatMessages.children.length === 0) {
        chatMessages.innerHTML = "";
        cacheLocal.forEach((item) => {
            chatMessages.appendChild(createMessageElement(item, item.id));
        });
        const maiorTs = Math.max(...cacheLocal.map(m => m.timestamp || 0), 0);
        if (maiorTs > ultimoTimestampCarregado) ultimoTimestampCarregado = maiorTs;
        scrollScreen();
    }
    
    const q = query(collection(db, "mensagens"), orderBy("timestamp", "asc"), limit(100));
    
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        // ===== PRIMEIRA CARGA (histórico) — não toca som =====
        if (snapshot.docChanges().length > 0 && ultimoTimestampCarregado === 0) {
            chatMessages.innerHTML = ""; 
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                chatMessages.appendChild(createMessageElement(data, docSnap.id));
                const ts = data.timestamp || 0;
                if (ts > ultimoTimestampCarregado) ultimoTimestampCarregado = ts;
            });
            scrollScreen();
            return;
        }

        // ===== ATUALIZAÇÕES EM TEMPO REAL =====
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const msg = change.doc.data();
                chatMessages.appendChild(createMessageElement(msg, change.doc.id));

                // ===== CACHE LOCAL: SALVA A NOVA MENSAGEM =====
                adicionarMensagemAoCache({ ...msg, id: change.doc.id });

                // Verifica se é uma mensagem REALMENTE nova (evita duplicar histórico)
                const isNewMessage = msg.timestamp > ultimoTimestampCarregado;
                if (isNewMessage) {
                    ultimoTimestampCarregado = msg.timestamp;
                }

                // Só toca som se:
                // 1) O som estiver ativado
                // 2) For uma mensagem nova (não do histórico inicial)
                // 3) NÃO for do próprio usuário (para não duplicar com o som local do envio)
                if (somAtivado && isNewMessage && msg.userId !== user.id) {
                    if (msg.isSystem) {
                        if (msg.content.includes("👉")) {
                            playSound(audioEntrou);
                        } else if (msg.content.includes("👈")) {
                            playSound(audioSaiu);
                        }
                    } else {
                        playSound(audioMensagem);
                    }
                }

                scrollScreen();
            } 
            else if (change.type === "removed") {
                const msgElement = chatMessages.querySelector(`[data-id="${change.doc.id}"]`);
                if (msgElement) {
                    msgElement.remove();
                }
                // ===== CACHE LOCAL: REMOVE A MENSAGEM APAGADA =====
                removerMensagemDoCache(change.doc.id);
            }
        });
    });
};

// ================= LISTA DE ONLINE E BANIDOS =================
const listenToOnlineUsers = () => {
    if (unsubscribeUsers) unsubscribeUsers();
    const q = query(collection(db, "usuarios_online"));
    unsubscribeUsers = onSnapshot(q, (snapshot) => {
        onlineList.innerHTML = "";
        let count = 0;
        snapshot.forEach((docSnap) => {
            const u = docSnap.data();
            count++;
            const li = document.createElement("li");
            const userInfo = document.createElement("div");
            userInfo.classList.add("user-info");
            
            let badge = u.isModerator ? ` <span class="moderator-badge">🛡️</span>` : "";
            userInfo.innerHTML = `${u.name}${badge}`;
            
            li.appendChild(userInfo);
            li.classList.add("user--online");
            
            if (user.isAdmin && u.name.toLowerCase() !== "admin") {
                const btnModerateUser = document.createElement("button");
                btnModerateUser.innerHTML = "🛡️"; 
                btnModerateUser.classList.add("btn-moderate-user");
                btnModerateUser.title = u.isModerator ? "Remover Moderador" : "Tornar Moderador";
                
                btnModerateUser.addEventListener("click", async () => {
                    const acao = u.isModerator ? "remover o cargo de moderador de" : "tornar moderador";
                    if (confirm(`Tem certeza que deseja ${acao} "${u.name}"?`)) {
                        try {
                            await setDoc(doc(db, "cargos", u.name.toLowerCase()), { isModerator: !u.isModerator });
                            await setDoc(doc(db, "usuarios_online", docSnap.id), { isModerator: !u.isModerator }, { merge: true });
                        } catch (e) { console.error("Erro ao moderar:", e); }
                    }
                });
                li.appendChild(btnModerateUser);

                const btnDeleteUser = document.createElement("button");
                btnDeleteUser.innerHTML = "✖"; 
                btnDeleteUser.classList.add("btn-delete-user");
                btnDeleteUser.addEventListener("click", async () => {
                    if (confirm(`Tem certeza que deseja BANIR "${u.name}"?`)) {
                        try {
                            await setDoc(doc(db, "banidos", u.name.toLowerCase()), { banido: true });
                            await deleteDoc(doc(db, "usuarios_online", docSnap.id));
                        } catch (e) { console.error("Erro ao banir:", e); }
                    }
                });
                li.appendChild(btnDeleteUser);
            }
            onlineList.appendChild(li);
        });
        onlineCount.innerText = count;
    });
};

const listenToOwnBanStatus = () => {
    if (unsubscribeBanCheck) unsubscribeBanCheck();
    const banCheckRef = doc(db, "banidos", user.name.toLowerCase());
    
    unsubscribeBanCheck = onSnapshot(banCheckRef, (docSnap) => {
        if (docSnap.exists()) {
            alert("Você foi banido do chat pelo administrador!");
            btnLogout.click(); 
        }
    });
};

const listenToBans = () => {
    if (unsubscribeBans) unsubscribeBans();
    const q = query(collection(db, "banidos"));
    unsubscribeBans = onSnapshot(q, (snapshot) => {
        bansList.innerHTML = "";
        if (snapshot.empty) {
            bansList.innerHTML = "<li style='justify-content:center; color: #888;'>Nenhum usuário banido.</li>";
            return;
        }
        snapshot.forEach((docSnap) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span style="text-transform: capitalize;">${docSnap.id}</span>
                <button class="btn-unban" data-id="${docSnap.id}">Desbanir</button>
            `;
            
            li.querySelector(".btn-unban").addEventListener("click", async () => {
                if (confirm(`Remover o banimento de "${docSnap.id}"?`)) {
                    await deleteDoc(doc(db, "banidos", docSnap.id));
                }
            });
            bansList.appendChild(li);
        });
    });
};

const sendSystemMessage = async (text) => {
    try { await addDoc(collection(db, "mensagens"), { isSystem: true, content: text, timestamp: Date.now() }); } 
    catch (e) { console.error(e); }
};

// ================= AUTENTICAÇÃO E LOGIN =================
toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    formTitle.innerText = isLoginMode ? "Login" : "Cadastro";
    submitBtn.innerText = isLoginMode ? "Entrar" : "Cadastrar";
    toggleMsg.innerText = isLoginMode ? "Não tem conta?" : "Já tem conta?";
    toggleLink.innerText = isLoginMode ? "Cadastre-se" : "Faça Login";
    
    emailInput.style.display = isLoginMode ? "none" : "block";
    forgotPasswordContainer.style.display = isLoginMode ? "block" : "none";
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = usernameInput.value.trim();
    const password = passwordInput.value;
    const email = emailInput.value.trim();

    try {
        if (isLoginMode) {
            if (!name) return alert("Por favor, digite seu nome de usuário.");
            
            const banidoDoc = await getDoc(doc(db, "banidos", name.toLowerCase()));
            if (banidoDoc.exists()) {
                return alert("Este usuário foi banido do chat pelo administrador.");
            }

            const perfilDoc = await getDoc(doc(db, "perfis", name.toLowerCase()));
            if (!perfilDoc.exists()) {
                return alert("Usuário não encontrado! Verifique o nome ou cadastre-se.");
            }
            const emailParaLogin = perfilDoc.data().email;

            const userCredential = await signInWithEmailAndPassword(auth, emailParaLogin, password);
            user.id = userCredential.user.uid;
            user.name = name;
            user.color = getRandomColor();

            // ===== LÓGICA DE SOM NO LOGIN =====
            // Tenta autoplay. Se falhar, o botão fica visível para o usuário ativar.
            audioEntrou.volume = 0.01;
            audioEntrou.play().then(() => {
                somAtivado = true;
                audioEntrou.volume = 1.0;
                atualizarBotaoSom();
                // Toca o som de entrada de verdade
                audioEntrou.currentTime = 0;
                audioEntrou.play().catch(() => {});
            }).catch(() => {
                somAtivado = false;
                audioEntrou.volume = 1.0;
                atualizarBotaoSom();
            });

            if (name.toLowerCase() === "admin") {
                user.isAdmin = true;
                document.body.classList.add("is-admin");
                adminBar.style.display = "block";
            } else {
                user.isAdmin = false;
                document.body.classList.remove("is-admin");
                adminBar.style.display = "none";
            }

            loginSection.style.display = "none";
            chatSection.style.display = "flex";
            btnEditName.style.display = "block";
            btnEditEmail.style.display = "block";
            
            const qUsuarios = query(collection(db, "usuarios_online"));
            const snapUsuarios = await getDocs(qUsuarios);
            const batchLimpeza = writeBatch(db);
            let limpouAlgo = false;

            snapUsuarios.forEach((d) => {
                if (d.data().name.toLowerCase() === user.name.toLowerCase() && d.id !== user.id) {
                    batchLimpeza.delete(d.ref);
                    limpouAlgo = true;
                }
            });

            if (limpouAlgo) await batchLimpeza.commit();

            // CHECA O CARGO ANTES DE RENDERIZAR
            const cargoDoc = await getDoc(doc(db, "cargos", user.name.toLowerCase()));
            if (cargoDoc.exists() && cargoDoc.data().isModerator) {
                user.isModerator = true;
            } else {
                user.isModerator = false;
            }

            await setDoc(doc(db, "usuarios_online", user.id), { 
                name: user.name, 
                color: user.color, 
                isModerator: user.isModerator 
            }, { merge: true });

            listenToMessages(); 
            listenToOnlineUsers();
            listenToMyRole(); 

            // ===== INDICADOR DE DIGITAÇÃO =====
            unsubscribeTyping = ouvirDigitando(db, user.id, (nomes) => {
                const texto = formatarTextoDigitando(nomes);
                if (texto) {
                    typingIndicator.innerText = texto;
                    typingIndicator.style.display = "block";
                } else {
                    typingIndicator.style.display = "none";
                    typingIndicator.innerText = "";
                }
            });
            
            if (!user.isAdmin) listenToOwnBanStatus(); 
            
            await sendSystemMessage(`👉 ${user.name} entrou no chat!`);

        } else {
            if (!email) return alert("Por favor, digite um e-mail válido para se cadastrar.");
            
            const banidoDoc = await getDoc(doc(db, "banidos", name.toLowerCase()));
            if (banidoDoc.exists()) {
                return alert("Este nome de usuário está banido e não pode ser cadastrado.");
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            
            await setDoc(doc(db, "perfis", name.toLowerCase()), { email: email });

            alert("Cadastro realizado com sucesso! Faça login.");
            toggleLink.click(); 
        }
    } catch (error) {
        if (error.code === "auth/email-already-in-use") alert("Este e-mail já está em uso!");
        else if (error.code === "auth/invalid-credential") alert("Nome ou senha incorretos!");
        else if (error.code === "auth/weak-password") alert("A senha precisa ter pelo menos 6 caracteres!");
        else alert("Erro: " + error.message);
    }
});

// ================= EVENTOS DO MODAL DE BANIDOS =================
btnManageBans.addEventListener("click", () => {
    bansModal.classList.add("show");
    listenToBans(); 
});

closeBansModal.addEventListener("click", () => {
    bansModal.classList.remove("show");
    if (unsubscribeBans) unsubscribeBans(); 
});

window.addEventListener("click", (e) => {
    if (e.target === bansModal) {
        bansModal.classList.remove("show");
        if (unsubscribeBans) unsubscribeBans();
    }
});

// ================= OUTRAS FUNÇÕES =================
forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("Digite seu E-MAIL cadastrado para receber o link de recuperação:");
    if (email) {
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Link de recuperação enviado! Verifique sua caixa de entrada.");
        } catch (error) {
            alert("Erro ao enviar e-mail: " + error.message);
        }
    }
});

btnEditName.addEventListener("click", async () => {
    const novoNome = prompt("Digite o seu novo nome de exibição:", user.name);
    if (novoNome && novoNome.trim() !== "" && novoNome.trim() !== user.name) {
        const nomeFormatado = novoNome.trim();
        
        const perfilExistente = await getDoc(doc(db, "perfis", nomeFormatado.toLowerCase()));
        if (perfilExistente.exists()) {
            return alert("Este nome já está em uso por outra pessoa.");
        }

        user.name = nomeFormatado;
        
        await updateProfile(auth.currentUser, { displayName: nomeFormatado });
        await setDoc(doc(db, "usuarios_online", user.id), { name: user.name, color: user.color }, { merge: true });

        const q = query(collection(db, "mensagens"));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach((docSnap) => {
            if (docSnap.data().userId === user.id) batch.update(docSnap.ref, { userName: user.name });
        });
        await batch.commit();
        
        alert("Nome atualizado com sucesso!");
    }
});

btnEditEmail.addEventListener("click", async () => {
    const novoEmail = prompt("Digite o NOVO e-mail para sua conta:", auth.currentUser.email);
    if (novoEmail && novoEmail.includes("@")) {
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
    }
});

btnLogout.addEventListener("click", async () => {
    if (user.id) {
        // Toca o som de saída LOCALMENTE (para o usuário que está saindo)
        if (somAtivado) {
            audioSaiu.currentTime = 0;
            audioSaiu.play().catch(e => console.log(e));
        }

        // Para de digitar ao sair
        estaDigitando = false;
        clearTimeout(timeoutPararDigitando);
        await pararDeDigitar(db, user.id).catch(() => {});
        
        await deleteDoc(doc(db, "usuarios_online", user.id));
        await sendSystemMessage(`👈 ${user.name} saiu do chat.`);
    }
    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeBanCheck) unsubscribeBanCheck();
    if (unsubscribeMyRole) unsubscribeMyRole();
    if (unsubscribeTyping) unsubscribeTyping();
    
    await signOut(auth);
    
    user.id = ""; user.name = ""; user.color = ""; user.isAdmin = false; user.isModerator = false;
    document.body.classList.remove("is-admin");
    chatMessages.innerHTML = "";
    onlineList.innerHTML = "";
    onlineCount.innerText = "0";
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

    // Reseta indicador de digitação
    estaDigitando = false;
    clearTimeout(timeoutPararDigitando);
    typingIndicator.style.display = "none";
    typingIndicator.innerText = "";
    
    if (!isLoginMode) toggleLink.click();
});

const sendMessageToDb = async (content) => {
    if (!content) return;
    
    const banCheck = await getDoc(doc(db, "banidos", user.name.toLowerCase()));
    if (banCheck.exists()) {
        alert("Você está banido e não pode enviar mensagens!");
        btnLogout.click();
        return;
    }

    try {
        await addDoc(collection(db, "mensagens"), {
            userId: user.id,
            userName: user.name,
            userColor: user.color,
            content: content,
            timestamp: Date.now()
        });
        // Toca o som LOCALMENTE para quem enviou (o listener ignora msg do próprio user)
        if (somAtivado) {
            audioMensagem.currentTime = 0;
            audioMensagem.play().catch(e => console.log(e));
        }
    } catch (e) { console.error("Erro ao enviar:", e); }
};

chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessageToDb(chatInput.value.trim());
    chatInput.value = "";

    // Para de digitar ao enviar
    estaDigitando = false;
    clearTimeout(timeoutPararDigitando);
    pararDeDigitar(db, user.id).catch(() => {});
});

// ================= INDICADOR DE DIGITAÇÃO (INPUT) =================
// Envia "digitando" a cada 1s no máximo (debounce)
const enviarDigitandoDebounced = criarDebounce(() => {
    if (!user.id) return;
    marcarComoDigitando(db, user).catch(() => {});
}, 1000);

chatInput.addEventListener("input", () => {
    if (!user.id) return;
    
    if (!estaDigitando) {
        estaDigitando = true;
        marcarComoDigitando(db, user).catch(() => {});
    }
    
    enviarDigitandoDebounced();
    
    // Reseta o timer que vai "parar de digitar" após 3s sem teclar
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
    if (stickersBar.classList.contains("show")) chatInput.focus();
});

btnClearAll.addEventListener("click", async () => {
    if (confirm("Apagar TODAS as mensagens?")) {
        try {
            const q = query(collection(db, "mensagens"));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
            await batch.commit();
            // ===== CACHE LOCAL: LIMPA O CACHE =====
            limparCache();
        } catch (e) { console.error(e); }
    }
});

// ================= BOTÃO DE LIGAR/DESLIGAR SOM =================
btnSom.addEventListener("click", () => {
    if (somAtivado) {
        // ---- DESLIGAR ----
        somAtivado = false;
        // Para qualquer áudio que esteja tocando
        [audioEntrou, audioSaiu, audioMensagem].forEach(a => {
            a.pause();
            a.currentTime = 0;
        });
        atualizarBotaoSom();
    } else {
        // ---- LIGAR ----
        // Toca um áudio silencioso para desbloquear o contexto de áudio do navegador
        const silentAudio = new Audio(SILENT_AUDIO);
        silentAudio.volume = 0.01;

        silentAudio.play().then(() => {
            somAtivado = true;
            atualizarBotaoSom();

            // Feedback: toca um som de entrada baixinho
            audioEntrou.volume = 0.5;
            audioEntrou.currentTime = 0;
            audioEntrou.play().finally(() => {
                audioEntrou.volume = 1.0;
            });
        }).catch(() => {
            alert("Não foi possível ativar o som. Verifique as permissões do navegador para este site.");
        });
    }
});