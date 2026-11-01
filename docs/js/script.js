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

const audioEntrou = new Audio("./sounds/entrou.mp3");
const audioSaiu = new Audio("./sounds/saiu.mp3");
const audioMensagem = new Audio("./sounds/mensagem.mp3");
audioEntrou.volume = 1.0; audioSaiu.volume = 1.0; audioMensagem.volume = 1.0;
let somAtivado = false;

const onlineList = document.querySelector("#online-list");
const onlineCount = document.querySelector("#online-count");

const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const formTitle = document.querySelector("#form-title");
const submitBtn = document.querySelector("#submit-btn");
const toggleMsg = document.querySelector("#toggle-msg");
const toggleLink = document.querySelector("#toggle-auth");

const colors = ["cadetblue", "darkgoldenrod", "cornflowerblue", "darkkhaki", "hotpink", "gold"];
const user = { id: "", name: "", color: "", isAdmin: false };

let isLoginMode = true;
let unsubscribeMessages = null;
let unsubscribeUsers = null;
let unsubscribeBans = null;
let unsubscribeBanCheck = null;

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
    let btnDelete = user.isAdmin ? `<button class="delete-btn" data-id="${docId}">[Apagar]</button>` : "";
    const formattedContent = formatMessageContent(msg.content);

    if (msg.userId === user.id) {
        div.classList.add("message--self");
        div.innerHTML = `<div class="message--content">${formattedContent}</div> ${btnDelete}`;
    } else {
        div.classList.add("message--other");
        div.innerHTML = `<span class="message--sender" style="color: ${msg.userColor}">${msg.userName}</span><div class="message--content">${formattedContent}</div> ${btnDelete}`;
    }

    if (user.isAdmin) {
        const btn = div.querySelector('.delete-btn');
        if (btn) btn.addEventListener('click', async () => { await deleteDoc(doc(db, "mensagens", docId)); });
    }
    return div;
};

const listenToMessages = () => {
    if (unsubscribeMessages) unsubscribeMessages();
    const q = query(collection(db, "mensagens"), orderBy("timestamp", "asc"), limit(100));
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = ""; 
        snapshot.forEach((docSnap) => chatMessages.appendChild(createMessageElement(docSnap.data(), docSnap.id)));
        scrollScreen();
    });
};

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
            userInfo.innerText = u.name;
            li.appendChild(userInfo);
            li.classList.add("user--online");
            
            if (user.isAdmin && u.name.toLowerCase() !== "admin") {
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
    
    // Esconde o e-mail no login e mostra no cadastro
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

            // NOVO: Busca o e-mail real no banco de dados, baseado no nome digitado
            const perfilDoc = await getDoc(doc(db, "perfis", name.toLowerCase()));
            if (!perfilDoc.exists()) {
                return alert("Usuário não encontrado! Verifique o nome ou cadastre-se.");
            }
            const emailParaLogin = perfilDoc.data().email;

            // Faz o login com o e-mail encontrado e a senha digitada
            const userCredential = await signInWithEmailAndPassword(auth, emailParaLogin, password);
            user.id = userCredential.user.uid;
            user.name = name;
            user.color = getRandomColor();

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
            
            if (!somAtivado) btnSom.style.display = "block";
            
            // Limpeza de duplicados
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

            await setDoc(doc(db, "usuarios_online", user.id), { name: user.name, color: user.color });
            listenToMessages(); 
            listenToOnlineUsers();
            
            if (!user.isAdmin) listenToOwnBanStatus(); 
            
            await sendSystemMessage(`👉 ${user.name} entrou no chat!`);

        } else {
            // CADASTRO
            if (!email) return alert("Por favor, digite um e-mail válido para se cadastrar.");
            
            const banidoDoc = await getDoc(doc(db, "banidos", name.toLowerCase()));
            if (banidoDoc.exists()) {
                return alert("Este nome de usuário está banido e não pode ser cadastrado.");
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            
            // NOVO: Salva o perfil para podermos buscar o e-mail pelo nome depois
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
        
        // Verifica se o novo nome já existe
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
    if (somAtivado) {
        audioSaiu.currentTime = 0;
        audioSaiu.play().catch(e => console.log(e));
    }
    if (user.id) {
        await deleteDoc(doc(db, "usuarios_online", user.id));
        await sendSystemMessage(`👈 ${user.name} saiu do chat.`);
    }
    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeBanCheck) unsubscribeBanCheck();
    
    await signOut(auth);
    
    user.id = ""; user.name = ""; user.color = ""; user.isAdmin = false;
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
        } catch (e) { console.error(e); }
    }
});

btnSom.addEventListener("click", () => {
    audioEntrou.currentTime = 0;
    audioEntrou.play().then(() => {
        somAtivado = true;
        btnSom.style.display = "none"; 
    }).catch(e => alert("O navegador não conseguiu tocar o som."));
});