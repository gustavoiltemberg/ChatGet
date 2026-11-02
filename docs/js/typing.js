// ================= INDICADOR DE DIGITAÇÃO =================
// Sincroniza "quem está digitando" no Firestore e atualiza a UI.
// Cada usuário tem um documento em "digitando/{uid}" com timestamp.
// Se o timestamp for recente (< TIMEOUT), consideramos que está digitando.

import { 
    collection, doc, setDoc, deleteDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const TIMEOUT_MS = 3000; // Se não atualizar em 3s, para de considerar "digitando"
const COLECAO = "digitando";

/**
 * Atualiza (ou cria) o documento do usuário como "digitando".
 * @param {Object} db - Firestore
 * @param {Object} user - { id, name }
 */
export const marcarComoDigitando = async (db, user) => {
    if (!user.id) return;
    try {
        await setDoc(doc(db, COLECAO, user.id), {
            name: user.name,
            timestamp: Date.now()
        });
    } catch (e) {
        console.warn("Erro ao marcar como digitando:", e);
    }
};

/**
 * Remove o documento do usuário (parou de digitar / enviou msg / saiu).
 * @param {Object} db - Firestore
 * @param {string} userId
 */
export const pararDeDigitar = async (db, userId) => {
    if (!userId) return;
    try {
        await deleteDoc(doc(db, COLECAO, userId));
    } catch (e) {
        console.warn("Erro ao parar de digitar:", e);
    }
};

/**
 * Escuta a coleção "digitando" e chama o callback com a lista de nomes
 * de quem está digitando AGORA (excluindo o próprio usuário).
 * @param {Object} db - Firestore
 * @param {string} meuUserId - ID do usuário logado (para não mostrar ele mesmo)
 * @param {Function} callback - Recebe um array de nomes
 * @returns {Function} unsubscribe
 */
export const ouvirDigitando = (db, meuUserId, callback) => {
    const colRef = collection(db, COLECAO);
    
    return onSnapshot(colRef, (snapshot) => {
        const agora = Date.now();
        const nomes = [];
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Ignora a si mesmo
            if (docSnap.id === meuUserId) return;
            // Ignora registros antigos (usuário fechou o navegador sem limpar)
            if (!data.timestamp || (agora - data.timestamp) > TIMEOUT_MS) return;
            if (data.name) nomes.push(data.name);
        });
        
        callback(nomes);
    });
};

/**
 * Monta o texto a exibir no indicador.
 * @param {Array} nomes - Nomes de quem está digitando
 * @returns {string} Texto formatado (ex: "João está digitando..." ou "João e Maria estão digitando...")
 */
export const formatarTextoDigitando = (nomes) => {
    if (nomes.length === 0) return "";
    if (nomes.length === 1) return `${nomes[0]} está digitando...`;
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]} estão digitando...`;
    return `${nomes[0]}, ${nomes[1]} e mais ${nomes.length - 2} estão digitando...`;
};

/**
 * Helper para "debounce" do envio de "digitando".
 * Retorna uma função que você chama a cada tecla, e ela só dispara
 * o callback a cada X ms (evita escrever no Firestore a cada letra).
 * @param {Function} fn - Callback a executar
 * @param {number} delay - Tempo mínimo entre execuções (ms)
 * @returns {Function}
 */
export const criarDebounce = (fn, delay = 1000) => {
    let ultimoEnvio = 0;
    return () => {
        const agora = Date.now();
        if (agora - ultimoEnvio >= delay) {
            ultimoEnvio = agora;
            fn();
        }
    };
};