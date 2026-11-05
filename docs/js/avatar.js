// avatar.js

/**
 * Retorna a URL de um avatar baseado no nome do usuário.
 * Se for admin, retorna uma imagem específica.
 * @param {string} nome - Nome do usuário
 * @returns {string} URL da imagem do avatar
 */
export const obterUrlAvatar = (nome, isModerator = false) => {
    if (!nome) nome = "Anonimo";

    // Limpa espaços e transforma em minúsculo para comparação
    const nomeLimpo = nome.trim();
    const nomeMinusculo = nomeLimpo.toLowerCase();

    // 1. Verifica se é Admin
    if (nomeMinusculo === "admin") {
        // Substitua pelo caminho real da sua imagem
        return "./images/admin.png"; 
    }

    // 2. Verifica se é Moderador
    if (isModerator) {
        return "./images/moderador.png";
    }

    // Paleta de 30 cores de fundo (códigos HEX sem o #)
    const coresFundo = [
        "212121", // cinza escuro
        "1e3a8a", // azul escuro
        "7c2d12", // marrom
        "14532d", // verde escuro
        "581c87", // roxo
        "831843", // vinho
        "0c4a6e", // azul petróleo
        "713f12", // mostarda escuro
        "3f6212", // oliva
        "4c1d95", // índigo
        "7f1d1d", // vermelho escuro
        "134e4a", // teal escuro
        "1e40af", // azul royal escuro
        "9a3412", // laranja queimado
        "166534", // verde floresta
        "6b21a8", // púrpura
        "9f1239", // framboesa escuro
        "155e75", // ciano escuro
        "854d0e", // âmbar escuro
        "4d7c0f", // verde lima escuro
        "3730a3", // azul índigo escuro
        "991b1b", // vermelho sangue
        "115e59", // verde esmeralda escuro
        "5b21b6", // violeta escuro
        "7e22ce", // roxo vibrante
        "be123c", // rosa escuro
        "0f766e", // turquesa escuro
        "a16207", // dourado escuro
        "365314", // verde musgo
        "1e293b"  // cinza azulado
    ];

    // Gera um índice de cor baseado no nome (hash simples)
    let hash = 0;
    for (let i = 0; i < nomeLimpo.length; i++) {
        hash = (hash * 31 + nomeLimpo.charCodeAt(i)) | 0;
    }
    const corIndex = Math.abs(hash) % coresFundo.length;
    const corFundo = coresFundo[corIndex];

    // URL correta da API ui-avatars
    const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeLimpo)}&background=${corFundo}&color=cadetblue&size=64&rounded=true&bold=true`;

    return url;
};