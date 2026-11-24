// avatar.js

export const obterUrlAvatar = (nome, isModerator = false) => {
    if (!nome) nome = "Anonimo";

    const nomeLimpo = nome.trim();
    const nomeMinusculo = nomeLimpo.toLowerCase();

    // 1. Verifica se é o Bot
    if (nomeMinusculo === "bot") {
        return "./images/bot.png";
    }

    // 2. Verifica se é Admin
    if (nomeMinusculo === "admin") {
        return "./images/admin.png";
    }

    // 3. Verifica se é Moderador
    if (isModerator) {
        return "./images/moderador.png";
    }

    // Paleta de 30 cores de fundo
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
    const corHex = coresFundo[corIndex];

    // Pega as iniciais corretamente (ex: "João Silva" -> "JS", "Teste" -> "TE")
    const partes = nomeLimpo.split(/\s+/).filter(Boolean);
    const iniciais = partes.length > 1
        ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
        : nomeLimpo.slice(0, 2).toUpperCase();

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

        ctx.fillStyle = "#5f9ea0";
        ctx.font = "bold 26px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(iniciais, 32, 34);

        return canvas.toDataURL("image/png");
    } catch (e) {
        return `https://ui-avatars.com{encodeURIComponent(nomeLimpo)}&background=${corHex}&color=5f9ea0&size=64&rounded=true&bold=true`;
    }
};
