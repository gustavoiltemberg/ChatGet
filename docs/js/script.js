// ================= CONFIGURAÇÃO DO FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    sendPasswordResetEmail,
    verifyBeforeUpdateEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    deleteDoc, 
    doc, 
    getDocs,
    writeBatch,
    setDoc,
    limit
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
const btnEditName = document.querySelector("#btn-edit-name");
const btnEditEmail = document.querySelector("#btn-edit-email");
const stickersBar = document.querySelector("#stickers-bar");
const btnGifKeyboard = document.querySelector("#btn-gif-keyboard");

const emailInput = document.querySelector("#email");
const forgotPasswordContainer = document.querySelector("#forgot-password-container");
const forgotPasswordLink = document.querySelector("#forgot-password");

const audioEntrou = new Audio("./sounds/entrou.mp3");
const audioSaiu = new Audio("./sounds/saiu.mp3");
const audioMensagem = new Audio("./sounds/mensagem.mp3");
audioEntrou.volume = 1.0;
audioSaiu.volume = 1.0;
audioMensagem.volume = 1.0;
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
                    if (confirm(`Expulsar "${u.name}" do chat?`)) await deleteDoc(doc(db, "usuarios_online", docSnap.id));
                });
                li.appendChild(btnDeleteUser);
            }
            onlineList.appendChild(li);
        });
        onlineCount.innerText = count;
    });
};

const sendSystemMessage = async (text) => {
    try { await addDoc(collection(db, "mensagens"), { isSystem: true, content: text, timestamp: Date.now() }); } 
    catch (e) { console.error(e); }
};

toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    formTitle.innerText = isLoginMode ? "Login" : "Cadastro";
    submitBtn.innerText = isLoginMode ? "Entrar" : "Cadastrar";
    toggleMsg.innerText = isLoginMode ? "Não tem conta?" : "Já tem conta?";
    toggleLink.innerText = isLoginMode ? "Cadastre-se" : "Faça Login";
    
    // Controla a visibilidade do e-mail e do link de esqueci a senha
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
            if (!email) return alert("Por favor, digite seu e-mail para fazer login.");
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
            
            await setDoc(doc(db, "usuarios_online", user.id), { name: user.name, color: user.color });
            listenToMessages(); 
            listenToOnlineUsers();
            await sendSystemMessage(`👉 ${user.name} entrou no chat!`);

        } else {
            if (!email) return alert("Por favor, digite um e-mail válido para se cadastrar.");
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            alert("Cadastro realizado com sucesso! Faça login.");
            toggleLink.click(); 
        }
    } catch (error) {
        if (error.code === "auth/email-already-in-use") alert("Este e-mail já está em uso!");
        else if (error.code === "auth/invalid-credential") alert("E-mail ou senha incorretos!");
        else if (error.code === "auth/weak-password") alert("A senha precisa ter pelo menos 6 caracteres!");
        else alert("Erro: " + error.message);
    }
});

forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("Digite seu e-mail para receber o link de recuperação:");
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