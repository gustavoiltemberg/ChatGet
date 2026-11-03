// ================= CONFIGURAÇÃO DO FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    sendPasswordResetEmail, verifyBeforeUpdateEmail, updateProfile
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

// ================= INDICADOR DE DIGITAÇÃO (UI) =================
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

const SILENT_AUDIO = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let somAtivado = false;

// ✅ CORREÇÃO: cor determinística baseada no uid (mesma pessoa = mesma cor sempre)
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

// ✅ CORREÇÃO: todos os unsubscribes centralizados
const unsubs = {
    messages: null,
    users: null,
    bans: null,
    banCheck: null,
    myRole: null,
    typing: null,
};

const cleanupAllListeners = () => {
    Object.keys(unsubs).forEach((k) => {
        if (unsubs[k]) { try { unsubs[k](); } catch (_) {} unsubs[k] = null; }
    });
};

let timeoutPararDigitando = null;
let estaDigitando = false;

// ================= FUNÇÕES AUXILIARES =================

// ✅ CORREÇÃO: rolar o CONTAINER, não a página (necessário no mobile)
let scrollPending = false;
const scrollScreen = () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        scrollPending = false;
    });
};

// ✅ CORREÇÃO: validação de domínio mais segura
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

// ✅ CORREÇÃO: usa textContent para evitar XSS
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
        div.textContent = msg.content; // ✅ antes era innerHTML
        div.dataset.id = docId;
        return div;
    }

    const div = document.createElement("div");
    div.dataset.id = docId;

    const isAdminMessage = (msg.userName || "").toLowerCase() === "admin";
    let podeApagar = false;
    if (user.isAdmin) podeApagar = true;
    else if (user.isModerator && !isAdminMessage) podeApagar = true;

    if (msg.userId === user.id) {
        div.classList.add("message--self");
    } else {
        div.classList.add("message--other");
        const sender = document.createElement("span");
        sender.className = "message--sender";
        sender.style.color = msg.userColor || colorFromId(msg.userId);
        sender.textContent = msg.userName || "Anônimo";
        div.appendChild(sender);
    }

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
            catch (e) { console.error("Erro ao apagar:", e); }
        });
        div.appendChild(btn);
    }

    return div;
};

// ================= REPRODUÇÃO DE SOM =================
// ✅ CORREÇÃO: sempre define volume antes de tocar
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

// ================= BOTÃO DE SOM =================
// ✅ CORREÇÃO: estado inicial consistente (desligado até login confirmar)
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

// ================= OUVINTE DE CARGO =================
const renderAllMessagesFromSnapshot = (snapshot) => {
    const frag = document.createDocumentFragment(); // ✅ fragment = mais rápido
    snapshot.forEach((d) => {
        frag.appendChild(createMessageElement(d.data(), d.id));
        const ts = d.data().timestamp || 0;
        if (ts > ultimoTimestampCarregado) ultimoTimestampCarregado = ts;
    });
    chatMessages.innerHTML = "";
    chatMessages.appendChild(frag);
    scrollScreen();
};

const listenToMyRole = () => {
    if (unsubs.myRole) unsubs.myRole();

    const myRoleRef = doc(db, "cargos", user.name.toLowerCase());
    unsubs.myRole = onSnapshot(myRoleRef, (docSnap) => {
        const isMod = docSnap.exists() && !!docSnap.data().isModerator;
        if (user.isModerator !== isMod) {
            user.isModerator = isMod;
            // re-render reutiliza a mesma lógica
            const q = query(collection(db, "mensagens"), orderBy("timestamp", "asc"), limit(100));
            getDocs(q).then(renderAllMessagesFromSnapshot).catch(console.error);
        }
    });
};

// ================= OUVINTE DE MENSAGENS =================
const listenToMessages = () => {
    if (unsubs.messages) unsubs.messages();
    ultimoTimestampCarregado = 0;

    const q = query(collection(db, "mensagens"), orderBy("timestamp", "asc"), limit(100));

    unsubs.messages = onSnapshot(q, (snapshot) => {
        // primeira carga (histórico)
        if (snapshot.docChanges().length > 0 && ultimoTimestampCarregado === 0) {
            renderAllMessagesFromSnapshot(snapshot);
            return;
        }

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const msg = change.doc.data();
                chatMessages.appendChild(createMessageElement(msg, change.doc.id));

                const isNewMessage = (msg.timestamp || 0) > ultimoTimestampCarregado;
                if (isNewMessage) ultimoTimestampCarregado = msg.timestamp;

                if (somAtivado && isNewMessage && msg.userId !== user.id) {
                    if (msg.isSystem) {
                        if (msg.content.includes("👉")) playSound(audioEntrou);
                        else if (msg.content.includes("👈")) playSound(audioSaiu);
                    } else {
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
};

// ================= LISTA DE ONLINE E BANIDOS =================
const listenToOnlineUsers = () => {
    if (unsubs.users) unsubs.users();
    const q = query(collection(db, "usuarios_online"));
    unsubs.users = onSnapshot(q, (snapshot) => {
        onlineList.innerHTML = "";
        let count = 0;
        snapshot.forEach((docSnap) => {
            const u = docSnap.data();
            count++;
            const li = document.createElement("li");
            const userInfo = document.createElement("div");
            userInfo.classList.add("user-info");

            let badge = u.isModerator
                ? ` <span class="moderator-badge" aria-label="Moderador">🛡️</span>`
                : "";
            userInfo.textContent = u.name;
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
                        await setDoc(doc(db, "cargos", u.name.toLowerCase()), { isModerator: !u.isModerator });
                        await setDoc(doc(db, "usuarios_online", docSnap.id), { isModerator: !u.isModerator }, { merge: true });
                    } catch (e) { console.error("Erro ao moderar:", e); }
                });
                li.appendChild(btnModerateUser);

                const btnDeleteUser = document.createElement("button");
                btnDeleteUser.textContent = "✖";
                btnDeleteUser.classList.add("btn-delete-user");
                btnDeleteUser.setAttribute("aria-label", "Banir usuário");
                btnDeleteUser.addEventListener("click", async () => {
                    if (!confirm(`Tem certeza que deseja BANIR "${u.name}"?`)) return;
                    try {
                        await setDoc(doc(db, "banidos", u.name.toLowerCase()), { banido: true });
                        await deleteDoc(doc(db, "usuarios_online", docSnap.id));
                    } catch (e) { console.error("Erro ao banir:", e); }
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
    const banCheckRef = doc(db, "banidos", user.name.toLowerCase());
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
                catch (e) { console.error(e); }
            });

            li.appendChild(span);
            li.appendChild(btn);
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
    formTitle.textContent = isLoginMode ? "Login" : "Cadastro";
    submitBtn.textContent = isLoginMode ? "Entrar" : "Cadastrar";
    toggleMsg.textContent = isLoginMode ? "Não tem conta?" : "Já tem conta?";
    toggleLink.textContent = isLoginMode ? "Cadastre-se" : "Faça Login";

    emailInput.style.display = isLoginMode ? "none" : "block";
    forgotPasswordContainer.style.display = isLoginMode ? "block" : "none";
});

// ✅ CORREÇÃO: login quebrado em função dedicada
const handleLogin = async (name, password) => {
    if (!name) return alert("Por favor, digite seu nome de usuário.");

    const banidoDoc = await getDoc(doc(db, "banidos", name.toLowerCase()));
    if (banidoDoc.exists()) return alert("Este usuário foi banido do chat pelo administrador.");

    const perfilDoc = await getDoc(doc(db, "perfis", name.toLowerCase()));
    if (!perfilDoc.exists()) return alert("Usuário não encontrado! Verifique o nome ou cadastre-se.");
    const emailParaLogin = perfilDoc.data().email;

    const cred = await signInWithEmailAndPassword(auth, emailParaLogin, password);
    user.id = cred.user.uid;
    user.name = name;
    user.color = colorFromId(user.id); // ✅ cor determinística

    // Som: tenta autoplay; se falhar, o botão fica visível para o usuário ativar
    audioEntrou.volume = 0.01;
    audioEntrou.play().then(() => {
        somAtivado = true;
        atualizarBotaoSom();
        playSound(audioEntrou); // ✅ usa helper
    }).catch(() => {
        audioEntrou.volume = 1.0;
        somAtivado = false;
        atualizarBotaoSom();
    });

    // ✅ admin identificado via e-mail especial ou custom claim
    // Aqui mantemos por nome, mas o ideal é custom claim:
    // const token = await cred.user.getIdTokenResult();
    // user.isAdmin = token.claims.admin === true;
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

    // limpa entradas antigas duplicadas
    const snapUsuarios = await getDocs(query(collection(db, "usuarios_online")));
    const batchLimpeza = writeBatch(db);
    let limpou = false;
    snapUsuarios.forEach((d) => {
        if (d.data().name.toLowerCase() === user.name.toLowerCase() && d.id !== user.id) {
            batchLimpeza.delete(d.ref);
            limpou = true;
        }
    });
    if (limpou) await batchLimpeza.commit();

    // checa cargo antes de renderizar
    const cargoDoc = await getDoc(doc(db, "cargos", user.name.toLowerCase()));
    user.isModerator = !!(cargoDoc.exists() && cargoDoc.data().isModerator);

    await setDoc(doc(db, "usuarios_online", user.id), {
        name: user.name,
        color: user.color,
        isModerator: user.isModerator
    }, { merge: true });

    listenToMessages();
    listenToOnlineUsers();
    listenToMyRole();

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

    await sendSystemMessage(`👉 ${user.name} entrou no chat!`);
};

// ✅ CORREÇÃO: cadastro em função dedicada + bloqueio do nome "admin"
const handleSignup = async (name, email, password) => {
    if (!name) return alert("Digite um nome de usuário.");
    if (!email) return alert("Por favor, digite um e-mail válido para se cadastrar.");
    if (name.toLowerCase() === "admin") {
        return alert("Este nome é reservado. Escolha outro.");
    }

    const banidoDoc = await getDoc(doc(db, "banidos", name.toLowerCase()));
    if (banidoDoc.exists()) return alert("Este nome de usuário está banido e não pode ser cadastrado.");

    const perfilExistente = await getDoc(doc(db, "perfis", name.toLowerCase()));
    if (perfilExistente.exists()) return alert("Este nome já está em uso.");

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "perfis", name.toLowerCase()), { email });

    alert("Cadastro realizado com sucesso! Faça login.");
    toggleLink.click();
};

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitBtn.disabled = true; // ✅ evita duplo-clique
    const name = usernameInput.value.trim();
    const password = passwordInput.value;
    const email = emailInput.value.trim();

    try {
        if (isLoginMode) await handleLogin(name, password);
        else await handleSignup(name, email, password);
    } catch (error) {
        if (error.code === "auth/email-already-in-use") alert("Este e-mail já está em uso!");
        else if (error.code === "auth/invalid-credential") alert("Nome ou senha incorretos!");
        else if (error.code === "auth/weak-password") alert("A senha precisa ter pelo menos 6 caracteres!");
        else alert("Erro: " + error.message);
    } finally {
        submitBtn.disabled = false;
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
    const nomeFormatado = novoNome.trim();

    if (nomeFormatado.toLowerCase() === "admin") {
        return alert("Este nome é reservado.");
    }

    try {
        const perfilExistente = await getDoc(doc(db, "perfis", nomeFormatado.toLowerCase()));
        if (perfilExistente.exists()) return alert("Este nome já está em uso por outra pessoa.");

        user.name = nomeFormatado;
        await updateProfile(auth.currentUser, { displayName: nomeFormatado });
        await setDoc(doc(db, "usuarios_online", user.id), { name: user.name, color: user.color }, { merge: true });

        // ✅ CORREÇÃO: query filtrada em vez de baixar todas as mensagens
        const q = query(collection(db, "mensagens"), where("userId", "==", user.id));
        const snap = await getDocs(q);

        // ✅ CORREÇÃO: batch em lotes de 500 (limite do Firestore)
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

// ✅ CORREÇÃO: logout quebrado em função, com try/catch
const cleanupChatSession = async () => {
    cleanupAllListeners();

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

    if (!isLoginMode) toggleLink.click();
};

btnLogout.addEventListener("click", async () => {
    try {
        if (user.id) {
            if (somAtivado) playSound(audioSaiu);
            estaDigitando = false;
            clearTimeout(timeoutPararDigitando);
            await pararDeDigitar(db, user.id).catch(() => {});
            await deleteDoc(doc(db, "usuarios_online", user.id)).catch(() => {});
            await sendSystemMessage(`👈 ${user.name} saiu do chat.`);
        }
    } catch (e) {
        console.error("Erro no logout:", e);
    } finally {
        await cleanupChatSession();
    }
});

const sendMessageToDb = async (content) => {
    // ✅ CORREÇÃO: guarda contra estado inválido
    if (!user.id || !content) return;

    try {
        const banCheck = await getDoc(doc(db, "banidos", user.name.toLowerCase()));
        if (banCheck.exists()) {
            alert("Você está banido e não pode enviar mensagens!");
            btnLogout.click();
            return;
        }

        await addDoc(collection(db, "mensagens"), {
            userId: user.id,
            userName: user.name,
            userColor: user.color,
            content,
            timestamp: Date.now()
        });

        if (somAtivado) playSound(audioMensagem);
    } catch (e) {
        console.error("Erro ao enviar:", e);
    }
};

chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessageToDb(chatInput.value.trim());
    chatInput.value = "";

    estaDigitando = false;
    clearTimeout(timeoutPararDigitando);
    pararDeDigitar(db, user.id).catch(() => {});
});

// ================= INDICADOR DE DIGITAÇÃO (INPUT) =================
const enviarDigitandoDebounced = criarDebounce(() => {
    if (!user.id) return;
    marcarComoDigitando(db, user).catch(() => {});
}, 1000);

chatInput.addEventListener("input", () => {
    if (!user.id) return;
    estaDigitando = true;
    enviarDigitandoDebounced(); // ✅ CORREÇÃO: não chama 2x na primeira tecla
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
    if (!confirm("Apagar TODAS as mensagens?")) return;
    try {
        const snap = await getDocs(query(collection(db, "mensagens")));
        // ✅ CORREÇÃO: batch em lotes de 500
        const MAX = 500;
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += MAX) {
            const batch = writeBatch(db);
            docs.slice(i, i + MAX).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    } catch (e) { console.error(e); }
});

// ================= BOTÃO DE SOM =================
btnSom.addEventListener("click", () => {
    if (somAtivado) {
        somAtivado = false;
        [audioEntrou, audioSaiu, audioMensagem].forEach((a) => {
            a.pause();
            a.currentTime = 0;
        });
        atualizarBotaoSom();
    } else {
        const silent = new Audio(SILENT_AUDIO);
        silent.volume = 0.01;
        silent.play().then(() => {
            somAtivado = true;
            atualizarBotaoSom();
            playSound(audioEntrou, 0.5);
        }).catch(() => {
            alert("Não foi possível ativar o som. Verifique as permissões do navegador para este site.");
        });
    }
});

// ✅ CORREÇÃO: limpar entrada em usuarios_online ao fechar a aba (best-effort)
window.addEventListener("beforeunload", () => {
    if (!user.id) return;
    // não dá para usar await aqui, mas deleteDoc dispara a requisição
    deleteDoc(doc(db, "usuarios_online", user.id)).catch(() => {});
});