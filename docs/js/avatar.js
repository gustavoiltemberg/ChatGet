// avatar.js

// Calcula se a cor de fundo é clara ou escura para escolher letra preta ou branca
const obterCorTexto = (hex) => {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brilho = (r * 299 + g * 587 + b * 114) / 1000;
    return brilho > 140 ? "#121212" : "#ffffff";
};

export const obterUrlAvatar = (nome, cargos = {}) => {
    if (!nome) nome = "Anonimo";

    // Mantém compatibilidade caso seja passado apenas true/false (isModerator)
    const roles = typeof cargos === "boolean" ? { isModerator: cargos } : (cargos || {});

    const nomeLimpo = String(nome).trim() || "Anonimo";
    const nomeMinusculo = nomeLimpo.toLowerCase();

    // 1. Verifica se é o Bot
    if (nomeMinusculo === "bot") {
        return "./images/bot.png";
    }

    // 2. Verifica se é Admin
    if (nomeMinusculo === "admin") {
        return "./images/admin.png";
    }

    // Verifica se possui cargo com emoji exclusivo (Moderador, Guardião, Ajudante ou VIP)
    let emojiCargo = "";
    let fundoCargo = "";

    if (roles.isModerator) {
        emojiCargo = "🛡️";
        fundoCargo = "4d3807"; // Dourado escuro para destacar o escudo 🛡️
    } else if (roles.isGuardian) {
        emojiCargo = "🔰";
        fundoCargo = "163a5f"; // Azul escuro para destacar o escudo 🔰
    } else if (roles.isHelper) {
        emojiCargo = "🌟";
        fundoCargo = "14452f"; // Verde escuro para destacar a estrela 🌟
    } else if (roles.isVip) {
        emojiCargo = "💎";
        fundoCargo = "3b185f"; // Roxo escuro para destacar o diamante 💎
    }

    // Paleta de 30 cores de fundo (para usuários comuns)
    const coresFundo = [
        "212121", "1e3a8a", "7c2d12", "14532d", "581c87",
        "831843", "0c4a6e", "713f12", "3f6212", "4c1d95",
        "7f1d1d", "134e4a", "1e40af", "9a3412", "166534",
        "6b21a8", "9f1239", "155e75", "854d0e", "4d7c0f",
        "3730a3", "991b1b", "115e59", "5b21b6", "7e22ce",
        "be123c", "0f766e", "a16207", "365314", "1e293b"
    ];

    let hash = 0;
    for (let i = 0; i < nomeLimpo.length; i++) {
        hash = (hash * 31 + nomeLimpo.charCodeAt(i)) | 0;
    }
    const corIndex = Math.abs(hash) % coresFundo.length;
    const corHex = fundoCargo || coresFundo[corIndex];
    const corTexto = obterCorTexto(corHex);

    // Pega as iniciais corretamente (ex: "João Silva" -> "JS", "Teste" -> "TE")
    const partes = nomeLimpo.split(/\s+/).filter(Boolean);
    const iniciais = partes.length > 1
        ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
        : nomeLimpo.slice(0, 2).toUpperCase();

    const textoCentral = emojiCargo || iniciais;

    // Gera um PNG local via Canvas
    try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = `#${corHex}`;
        ctx.beginPath();
        ctx.arc(32, 32, 32, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = corTexto;
        ctx.font = emojiCargo
            ? "44px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', Arial, sans-serif"
            : "bold 26px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(textoCentral, 32, 35);

        return canvas.toDataURL("image/png");
    } catch (e) {
        const corTextoHex = corTexto.replace("#", "");
        const urlBase = ["https://ui-avatars.com", "api", "?name="].join("/");
        return urlBase + encodeURIComponent(textoCentral) + "&background=" + corHex + "&color=" + corTextoHex + "&size=64&rounded=true&bold=true";
    }
};
