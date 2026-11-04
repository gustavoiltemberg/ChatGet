// presence.js
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Formata o nome para exibição (primeira letra maiúscula)
const formatarNome = (nome) => {
    if (!nome) return "Anônimo";
    return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
};

const enviarMensagemSistema = async (db, texto) => {
    try {
        await addDoc(collection(db, "mensagens"), {
            isSystem: true,
            content: texto,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error("Erro ao enviar mensagem de sistema:", e);
        throw e; // ✅ repassa o erro para quem chamou poder tratar
    }
};

export const anunciarEntrada = (db, nome) => {
    return enviarMensagemSistema(db, `👉 ${formatarNome(nome)} entrou no chat!`);
};

export const anunciarSaida = (db, nome) => {
    return enviarMensagemSistema(db, `👈 ${formatarNome(nome)} saiu do chat.`);
};