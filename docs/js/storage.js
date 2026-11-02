// ================= CACHE LOCAL DE MENSAGENS =================
// Salva as últimas N mensagens no localStorage para carregamento instantâneo.
// Não substitui o Firestore — apenas melhora a experiência inicial.

const CACHE_KEY = "chat_cache_mensagens";
const CACHE_LIMITE = 200; // máximo de mensagens guardadas

/**
 * Salva o array de mensagens no localStorage.
 * @param {Array} mensagens - Array de objetos {id, ...dados}
 */
export const salvarMensagensNoCache = (mensagens) => {
    try {
        const reduzido = mensagens.slice(-CACHE_LIMITE);
        localStorage.setItem(CACHE_KEY, JSON.stringify(reduzido));
    } catch (e) {
        console.warn("Não foi possível salvar o cache:", e);
    }
};

/**
 * Adiciona UMA mensagem ao cache (evita reescrever tudo a cada nova msg).
 * @param {Object} msg - Objeto da mensagem (com id)
 */
export const adicionarMensagemAoCache = (msg) => {
    try {
        const cache = carregarMensagensDoCache();
        cache.push(msg);
        const reduzido = cache.slice(-CACHE_LIMITE);
        localStorage.setItem(CACHE_KEY, JSON.stringify(reduzido));
    } catch (e) {
        console.warn("Não foi possível adicionar ao cache:", e);
    }
};

/**
 * Remove UMA mensagem do cache (quando ela é apagada no Firestore).
 * @param {string} docId - ID do documento
 */
export const removerMensagemDoCache = (docId) => {
    try {
        const cache = carregarMensagensDoCache();
        const filtrado = cache.filter(m => m.id !== docId);
        localStorage.setItem(CACHE_KEY, JSON.stringify(filtrado));
    } catch (e) {
        console.warn("Não foi possível remover do cache:", e);
    }
};

/**
 * Carrega as mensagens do cache.
 * @returns {Array} Array de mensagens (ou vazio se não houver cache)
 */
export const carregarMensagensDoCache = () => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        console.warn("Cache corrompido, limpando...", e);
        localStorage.removeItem(CACHE_KEY);
        return [];
    }
};

/**
 * Limpa o cache (usado no botão "Limpar Tudo").
 */
export const limparCache = () => {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (e) {
        console.warn("Não foi possível limpar o cache:", e);
    }
};