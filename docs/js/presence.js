// presence.js
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
        throw e;
    }
};

// ✅ Agora recebe o áudio e o status do som como parâmetros
export const anunciarEntrada = (db, nome, audio, somAtivado) => {
    if (somAtivado && audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
    return enviarMensagemSistema(db, `🟢 ${formatarNome(nome)} entrou`);
};

export const anunciarSaida = (db, nome, audio, somAtivado) => {
    if (somAtivado && audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
    return enviarMensagemSistema(db, `🔴 ${formatarNome(nome)} saiu`);
};