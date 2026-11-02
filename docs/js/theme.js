// ================= THEME SWITCHER (CLARO/ESCURO) =================
// Gerencia o tema claro/escuro com persistência no localStorage.
// Aplica a classe "light-mode" no <body> — o CSS faz o resto.

const STORAGE_KEY = "chat_theme"; // "dark" ou "light"

/**
 * Retorna o tema atual salvo no localStorage (ou "dark" por padrão).
 * @returns {"dark"|"light"}
 */
export const obterTemaSalvo = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    } catch (e) {
        return "dark";
    }
};

/**
 * Aplica o tema no <body> e salva no localStorage.
 * @param {"dark"|"light"} tema
 */
export const aplicarTema = (tema) => {
    if (tema === "light") {
        document.body.classList.add("light-mode");
    } else {
        document.body.classList.remove("light-mode");
    }
    try {
        localStorage.setItem(STORAGE_KEY, tema);
    } catch (e) {
        console.warn("Não foi possível salvar o tema:", e);
    }
};

/**
 * Alterna entre claro e escuro. Retorna o novo tema.
 * @returns {"dark"|"light"}
 */
export const alternarTema = () => {
    const atual = obterTemaSalvo();
    const novo = atual === "light" ? "dark" : "light";
    aplicarTema(novo);
    return novo;
};

/**
 * Inicializa o tema salvado (chamar no carregamento da página).
 */
export const inicializarTema = () => {
    aplicarTema(obterTemaSalvo());
};

/**
 * Atualiza o texto/ícone do botão conforme o tema atual.
 * @param {HTMLElement} btn - O botão de tema
 */
export const atualizarBotaoTema = (btn) => {
    const tema = obterTemaSalvo();
    if (tema === "light") {
        btn.innerText = "🌙";
        btn.title = "Clique para ativar o modo escuro";
    } else {
        btn.innerText = "☀️";
        btn.title = "Clique para ativar o modo claro";
    }
};

/**
 * Configura o botão de tema (listener + estado inicial).
 * @param {HTMLElement} btn - O botão
 */
export const configurarBotaoTema = (btn) => {
    if (!btn) return;
    
    atualizarBotaoTema(btn);
    
    btn.addEventListener("click", () => {
        alternarTema();
        atualizarBotaoTema(btn);
    });
};