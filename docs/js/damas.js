// docs/js/damas.js
import {
    doc, setDoc, onSnapshot, addDoc, collection, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const JOGO_DOC = ["jogos", "damas_atual"];

// Peças: 0 = vazio | 1 = branca | 2 = dama branca | 3 = preta | 4 = dama preta
const criarTabuleiroInicial = () => {
    const tab = new Array(64).fill(0);
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 1) {
                if (r < 3) tab[r * 8 + c] = 3;      // Pretas em cima
                else if (r > 4) tab[r * 8 + c] = 1; // Brancas embaixo
            }
        }
    }
    return tab;
};

const ehBranca = (p) => p === 1 || p === 2;
const ehPreta  = (p) => p === 3 || p === 4;
const ehDama   = (p) => p === 2 || p === 4;
const pertenceAoTurno = (p, turno) => (turno === "brancas" ? ehBranca(p) : ehPreta(p));
const ehInimiga       = (p, turno) => (turno === "brancas" ? ehPreta(p)  : ehBranca(p));
const dentro = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

const formatarNome = (nome) => {
    if (!nome) return "Anônimo";
    return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
};

// ================= EFEITOS SONOROS (WEB AUDIO API) =================
let audioCtxDamas = null;

const tocarSomDamas = (tipo) => {
    // Respeita o botão de som do chat (se estiver mutado, não toca)
    const btnSom = document.getElementById("btn-som");
    if (btnSom && btnSom.classList.contains("muted")) return;

    try {
        if (!audioCtxDamas) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioCtxDamas = new AudioCtx();
        }
        if (audioCtxDamas.state === "suspended") {
            audioCtxDamas.resume();
        }

        const agora = audioCtxDamas.currentTime;

        if (tipo === "mover") {
            // Som seco de peça tocando o tabuleiro
            const osc = audioCtxDamas.createOscillator();
            const gain = audioCtxDamas.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(280, agora);
            osc.frequency.exponentialRampToValueAtTime(110, agora + 0.08);

            gain.gain.setValueAtTime(0.25, agora);
            gain.gain.exponentialRampToValueAtTime(0.001, agora + 0.09);

            osc.connect(gain);
            gain.connect(audioCtxDamas.destination);
            osc.start(agora);
            osc.stop(agora + 0.09);
        } 
        else if (tipo === "dama") {
            // Arpejo rápido brilhante ao promover para Dama (👑)
            const notas = [523.25, 659.25, 783.99, 1046.5]; // Dó, Mi, Sol, Dó agudo
            notas.forEach((freq, i) => {
                const osc = audioCtxDamas.createOscillator();
                const gain = audioCtxDamas.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, agora + i * 0.07);

                gain.gain.setValueAtTime(0.2, agora + i * 0.07);
                gain.gain.exponentialRampToValueAtTime(0.001, agora + i * 0.07 + 0.22);

                osc.connect(gain);
                gain.connect(audioCtxDamas.destination);
                osc.start(agora + i * 0.07);
                osc.stop(agora + i * 0.07 + 0.22);
            });
        } 
        else if (tipo === "vitoria") {
            // Fanfarra de vitória
            const notas = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
            const tempos = [0, 0.11, 0.22, 0.33, 0.50, 0.64];
            const duracoes = [0.12, 0.12, 0.12, 0.16, 0.13, 0.45];

            notas.forEach((freq, i) => {
                const osc = audioCtxDamas.createOscillator();
                const gain = audioCtxDamas.createGain();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, agora + tempos[i]);

                gain.gain.setValueAtTime(0.25, agora + tempos[i]);
                gain.gain.exponentialRampToValueAtTime(0.001, agora + tempos[i] + duracoes[i]);

                osc.connect(gain);
                gain.connect(audioCtxDamas.destination);
                osc.start(agora + tempos[i]);
                osc.stop(agora + tempos[i] + duracoes[i]);
            });
        }
    } catch (e) {
        console.warn("Áudio das damas bloqueado pelo navegador:", e);
    }
};

// ================= MOTOR DE REGRAS DAS DAMAS =================
const obterCapturasDaPeca = (tab, idx, turno) => {
    const peca = tab[idx];
    if (!pertenceAoTurno(peca, turno)) return [];

    const r0 = Math.floor(idx / 8);
    const c0 = idx % 8;
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const movimentos = [];

    if (!ehDama(peca)) {
        // Peça comum captura 1 casa nas 4 diagonais
        for (const [dr, dc] of dirs) {
            const rMeio = r0 + dr;
            const cMeio = c0 + dc;
            const rDest = r0 + dr * 2;
            const cDest = c0 + dc * 2;

            if (dentro(rDest, cDest) && dentro(rMeio, cMeio)) {
                const meio = tab[rMeio * 8 + cMeio];
                const dest = tab[rDest * 8 + cDest];
                if (ehInimiga(meio, turno) && dest === 0) {
                    movimentos.push({
                        from: idx,
                        to: rDest * 8 + cDest,
                        captured: rMeio * 8 + cMeio
                    });
                }
            }
        }
    } else {
        // Dama voadora captura à distância na diagonal
        for (const [dr, dc] of dirs) {
            let r = r0 + dr;
            let c = c0 + dc;
            let inimigoIdx = -1;

            while (dentro(r, c)) {
                const atual = tab[r * 8 + c];
                if (atual === 0) {
                    if (inimigoIdx !== -1) {
                        movimentos.push({
                            from: idx,
                            to: r * 8 + c,
                            captured: inimigoIdx
                        });
                    }
                } else if (ehInimiga(atual, turno)) {
                    if (inimigoIdx !== -1) break; // Não pula duas peças seguidas
                    inimigoIdx = r * 8 + c;
                } else {
                    break; // Peça própria bloqueando
                }
                r += dr;
                c += dc;
            }
        }
    }
    return movimentos;
};

const obterMovimentosSimplesDaPeca = (tab, idx, turno) => {
    const peca = tab[idx];
    if (!pertenceAoTurno(peca, turno)) return [];

    const r0 = Math.floor(idx / 8);
    const c0 = idx % 8;
    const movimentos = [];

    if (!ehDama(peca)) {
        const dirFrente = turno === "brancas" ? -1 : 1;
        for (const dc of [-1, 1]) {
            const rDest = r0 + dirFrente;
            const cDest = c0 + dc;
            if (dentro(rDest, cDest) && tab[rDest * 8 + cDest] === 0) {
                movimentos.push({ from: idx, to: rDest * 8 + cDest, captured: null });
            }
        }
    } else {
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            let r = r0 + dr;
            let c = c0 + dc;
            while (dentro(r, c) && tab[r * 8 + c] === 0) {
                movimentos.push({ from: idx, to: r * 8 + c, captured: null });
                r += dr;
                c += dc;
            }
        }
    }
    return movimentos;
};

const obterTodosMovimentosValidos = (tab, turno, pecaForcada = null) => {
    const indices = pecaForcada !== null
        ? [pecaForcada]
        : Array.from({ length: 64 }, (_, i) => i);

    let capturas = [];
    for (const i of indices) {
        if (pertenceAoTurno(tab[i], turno)) {
            capturas = capturas.concat(obterCapturasDaPeca(tab, i, turno));
        }
    }
    // Captura obrigatória
    if (capturas.length > 0) return capturas;
    if (pecaForcada !== null) return [];

    let simples = [];
    for (const i of indices) {
        if (pertenceAoTurno(tab[i], turno)) {
            simples = simples.concat(obterMovimentosSimplesDaPeca(tab, i, turno));
        }
    }
    return simples;
};

// ================= INJEÇÃO DE ESTILOS =================
const injetarEstilosDamas = () => {
    if (document.getElementById("damas-styles")) return;
    const style = document.createElement("style");
    style.id = "damas-styles";
    style.textContent = `
        .damas-modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.78);
            z-index: 200;
            align-items: center;
            justify-content: center;
            padding: 12px;
        }
        .damas-modal.show { display: flex; }
        .damas-box {
            background: #1e1e1e;
            color: #f2f2f2;
            border: 1px solid #3a3a3a;
            border-radius: 12px;
            padding: 16px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            gap: 12px;
            position: relative;
        }
        .damas-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #333;
            padding-bottom: 8px;
        }
        .damas-header h3 { font-size: 1.05rem; margin: 0; }
        .damas-close {
            background: none;
            border: none;
            color: #aaa;
            font-size: 1.5rem;
            cursor: pointer;
            line-height: 1;
        }
        .damas-close:hover { color: #fff; }
        .damas-players {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            font-size: 0.82rem;
        }
        .damas-player-card {
            flex: 1;
            background: #282828;
            padding: 8px;
            border-radius: 8px;
            border: 2px solid transparent;
            text-align: center;
        }
        .damas-player-card.active {
            border-color: cadetblue;
            background: #233335;
        }
        .damas-status {
            text-align: center;
            font-size: 0.85rem;
            font-weight: 600;
            padding: 6px 10px;
            background: #262626;
            border-radius: 6px;
            color: #9be7ea;
        }
        .damas-board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr); /* Trava a altura igual das 8 linhas */
            width: min(82vw, 352px);
            height: min(82vw, 352px);
            aspect-ratio: 1 / 1;
            margin: 0 auto;
            border: 3px solid #444;
            border-radius: 6px;
            overflow: hidden;
            user-select: none;
        }
        .damas-cell {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            min-width: 0;
            min-height: 0;
            overflow: hidden; /* Impede que o emoji estique a casa */
        }
        .damas-cell.light { background: #e8dcc8; }
        .damas-cell.dark { background: #5c4033; }
        .damas-cell.valid-move { cursor: pointer; }
        .damas-cell.valid-move::after {
            content: "";
            width: 34%;
            height: 34%;
            border-radius: 50%;
            background: rgba(46, 204, 113, 0.85);
            box-shadow: 0 0 8px #2ecc71;
        }
        .damas-piece {
            width: 78%;
            height: 78%;
            aspect-ratio: 1 / 1; /* Garante que a peça seja sempre um círculo perfeito */
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: clamp(0.75rem, 3.2vw, 1rem); /* Ajusta o tamanho da coroa no mobile e desktop */
            line-height: 1;
            transition: transform 0.15s, box-shadow 0.15s;
        }
        .damas-piece.white {
            background: radial-gradient(circle at 30% 30%, #ffffff, #cfd8dc);
            border: 2px solid #90a4ae;
            color: #b8860b;
            box-shadow: 0 3px 5px rgba(0,0,0,0.45);
        }
        .damas-piece.black {
            background: radial-gradient(circle at 30% 30%, #424242, #121212);
            border: 2px solid #757575;
            color: #ffd700;
            box-shadow: 0 3px 5px rgba(0,0,0,0.65);
        }
        .damas-piece.selectable {
            cursor: pointer;
            box-shadow: 0 0 0 3px #f1c40f;
        }
        .damas-piece.selected {
            transform: scale(1.12);
            box-shadow: 0 0 0 3px #2ecc71, 0 4px 10px rgba(0,0,0,0.6);
        }
        .damas-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
        }
        .damas-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            background: cadetblue;
            color: #fff;
            transition: 0.2s;
        }
        .damas-btn:hover { filter: brightness(1.1); }
        .damas-btn.danger { background: #c0392b; }
        .damas-btn.secondary { background: #444; }
    `;
    document.head.appendChild(style);
};

// ================= INICIALIZAÇÃO E INTERFACE =================
let unsubDamas = null;

export const iniciarJogoDamas = (db, user) => {
    injetarEstilosDamas();

    // 1. Botão no cabeçalho do chat
    const headerScroll = document.querySelector(".chat__header-scroll");
    if (headerScroll && !document.getElementById("btn-open-damas")) {
        const btnOpen = document.createElement("button");
        btnOpen.id = "btn-open-damas";
        btnOpen.className = "btn-edit-name";
        btnOpen.textContent = "♟️";
        btnOpen.title = "Abrir jogo de Damas";
        headerScroll.insertBefore(btnOpen, headerScroll.firstChild);
        btnOpen.addEventListener("click", () => {
            document.getElementById("damas-modal")?.classList.add("show");
        });
    }

    // 2. Modal do tabuleiro
    if (!document.getElementById("damas-modal")) {
        const modal = document.createElement("div");
        modal.id = "damas-modal";
        modal.className = "damas-modal";
        modal.innerHTML = `
            <div class="damas-box">
                <div class="damas-header">
                    <h3>♟️ Damas Ao Vivo</h3>
                    <button class="damas-close" id="damas-close-btn">&times;</button>
                </div>
                <div class="damas-players">
                    <div class="damas-player-card" id="card-brancas">⚪ Brancas: <strong>Livre</strong></div>
                    <div class="damas-player-card" id="card-pretas">⚫ Pretas: <strong>Livre</strong></div>
                </div>
                <div class="damas-status" id="damas-status-text">Carregando tabuleiro...</div>
                <div class="damas-board" id="damas-board"></div>
                <div class="damas-actions" id="damas-actions"></div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById("damas-close-btn").addEventListener("click", () => {
            modal.classList.remove("show");
        });
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("show");
        });
    }

    const anunciarNoChat = async (texto) => {
        try {
            await addDoc(collection(db, "mensagens"), {
                isSystem: true,
                content: `♟️ ${texto}`,
                timestamp: Date.now()
            });
        } catch (e) {
            console.warn("Aviso damas:", e);
        }
    };

    // Estado local
    let selectedIdx = null;
    let estadoAtual = null;
    const jogoRef = doc(db, ...JOGO_DOC);

    const nomeUsuario = user?.name || "Anônimo";
    const idUsuario   = user?.id   || "";

    const salvarEstado = async (novoEstado) => {
        try {
            await setDoc(jogoRef, novoEstado);
        } catch (e) {
            console.error("Erro ao salvar estado das damas:", e);
        }
    };

    const executarMovimento = async (mov) => {
        if (!estadoAtual) return;
        const tab = [...estadoAtual.board];
        const turno = estadoAtual.turn;
        const peca = tab[mov.from];

        tab[mov.from] = 0;
        if (mov.captured !== null) tab[mov.captured] = 0;
        tab[mov.to] = peca;

        // Verifica se há nova captura em cadeia com a mesma peça
        let proximasCapturas = [];
        if (mov.captured !== null) {
            proximasCapturas = obterCapturasDaPeca(tab, mov.to, turno);
        }

        if (proximasCapturas.length > 0) {
            selectedIdx = mov.to;
            await salvarEstado({
                ...estadoAtual,
                board: tab,
                mustContinueFrom: mov.to
            });
            return;
        }

        // Fim do turno: promoção para Dama
        const rDest = Math.floor(mov.to / 8);
        if (peca === 1 && rDest === 0) tab[mov.to] = 2;
        if (peca === 3 && rDest === 7) tab[mov.to] = 4;

        const proximoTurno = turno === "brancas" ? "pretas" : "brancas";
        const movsAdversario = obterTodosMovimentosValidos(tab, proximoTurno);
        selectedIdx = null;

        // Vitória
        if (movsAdversario.length === 0) {
            const vencedorNome = turno === "brancas" ? estadoAtual.whiteName : estadoAtual.blackName;
            const perdedorNome = turno === "brancas" ? estadoAtual.blackName : estadoAtual.whiteName;
            await salvarEstado({
                ...estadoAtual,
                board: tab,
                status: "finalizado",
                winner: vencedorNome,
                mustContinueFrom: null
            });
            await anunciarNoChat(
                `${formatarNome(vencedorNome)} venceu ${formatarNome(perdedorNome)} nas Damas! 🏆`
            );
            return;
        }

        await salvarEstado({
            ...estadoAtual,
            board: tab,
            turn: proximoTurno,
            mustContinueFrom: null
        });
    };

    const renderizar = () => {
        const boardEl      = document.getElementById("damas-board");
        const statusEl     = document.getElementById("damas-status-text");
        const actionsEl    = document.getElementById("damas-actions");
        const cardBrancas  = document.getElementById("card-brancas");
        const cardPretas   = document.getElementById("card-pretas");
        if (!boardEl) return;

        const st = estadoAtual || {
            status: "aguardando",
            whiteId: "",
            whiteName: "",
            blackId: "",
            blackName: "",
            turn: "brancas",
            board: criarTabuleiroInicial(),
            mustContinueFrom: null,
            winner: ""
        };

        const souBrancas = st.whiteId === idUsuario;
        const souPretas  = st.blackId === idUsuario;
        const minhaCor   = souBrancas ? "brancas" : souPretas ? "pretas" : null;
        const minhaVez   = st.status === "jogando" && minhaCor === st.turn;

        // Cartões dos jogadores
        cardBrancas.innerHTML = `⚪ Brancas: <strong>${st.whiteName ? formatarNome(st.whiteName) : "Livre"}</strong>`;
        cardPretas.innerHTML  = `⚫ Pretas: <strong>${st.blackName  ? formatarNome(st.blackName)  : "Livre"}</strong>`;
        cardBrancas.classList.toggle("active", st.status === "jogando" && st.turn === "brancas");
        cardPretas.classList.toggle("active",  st.status === "jogando" && st.turn === "pretas");

        // Status textual
        if (st.status === "aguardando") {
            statusEl.textContent = "Aguardando jogadores entrarem na mesa...";
        } else if (st.status === "finalizado") {
            statusEl.textContent = `🏆 Vitória de ${formatarNome(st.winner)}!`;
        } else {
            const nomeVez = st.turn === "brancas" ? st.whiteName : st.blackName;
            statusEl.textContent = minhaVez
                ? (st.mustContinueFrom !== null
                    ? "🔥 Sua vez: continue a captura!"
                    : "🟢 Sua vez de jogar!")
                : `⏳ Vez de ${formatarNome(nomeVez)} (${st.turn})`;
        }

        // Movimentos válidos
        const todosMovs = minhaVez
            ? obterTodosMovimentosValidos(st.board, st.turn, st.mustContinueFrom)
            : [];
        const pecasMoviveis = new Set(todosMovs.map((m) => m.from));

        // Se está em combo obrigatório, força a peça
        if (st.mustContinueFrom !== null && minhaVez) {
            selectedIdx = st.mustContinueFrom;
        }
        if (selectedIdx !== null && !pecasMoviveis.has(selectedIdx)) {
            selectedIdx = null;
        }

        const destinosValidos = selectedIdx !== null
            ? todosMovs.filter((m) => m.from === selectedIdx)
            : [];

        // Desenha as 64 casas (inverte se o usuário jogar com as Pretas)
        boardEl.innerHTML = "";
        const ordem = Array.from({ length: 64 }, (_, i) => (souPretas ? 63 - i : i));

        for (const idx of ordem) {
            const r = Math.floor(idx / 8);
            const c = idx % 8;
            const cell = document.createElement("div");
            cell.className = `damas-cell ${(r + c) % 2 === 1 ? "dark" : "light"}`;

            const movDestino = destinosValidos.find((m) => m.to === idx);
            if (movDestino) {
                cell.classList.add("valid-move");
                cell.addEventListener("click", () => {
                    executarMovimento(movDestino).catch(console.error);
                });
            }

            const peca = st.board[idx];
            if (peca !== 0) {
                const pieceEl = document.createElement("div");
                pieceEl.className = `damas-piece ${ehBranca(peca) ? "white" : "black"}`;
                if (ehDama(peca)) pieceEl.textContent = "👑";

                if (minhaVez && pecasMoviveis.has(idx)) {
                    pieceEl.classList.add("selectable");
                    if (selectedIdx === idx) pieceEl.classList.add("selected");
                    pieceEl.addEventListener("click", (e) => {
                        e.stopPropagation();
                        // Se está em combo obrigatório, não permite desselecionar
                        if (st.mustContinueFrom !== null) {
                            selectedIdx = st.mustContinueFrom;
                        } else {
                            selectedIdx = selectedIdx === idx ? null : idx;
                        }
                        renderizar();
                    });
                }
                cell.appendChild(pieceEl);
            }
            boardEl.appendChild(cell);
        }

        // Botões de ação
        actionsEl.innerHTML = "";

        if (st.status === "aguardando") {
            if (!st.whiteId && !souPretas) {
                const btnB = document.createElement("button");
                btnB.className = "damas-btn";
                btnB.textContent = "⚪ Jogar de Brancas";
                btnB.onclick = async () => {
                    const prontos = !!st.blackId;
                    await salvarEstado({
                        ...st,
                        whiteId: idUsuario,
                        whiteName: nomeUsuario,
                        status: prontos ? "jogando" : "aguardando",
                        board: criarTabuleiroInicial(),
                        turn: "brancas"
                    });
                    if (prontos) {
                        await anunciarNoChat(
                            `Partida de Damas iniciada: ${formatarNome(nomeUsuario)} (⚪) vs ${formatarNome(st.blackName)} (⚫)!`
                        );
                    }
                };
                actionsEl.appendChild(btnB);
            }
            if (!st.blackId && !souBrancas) {
                const btnP = document.createElement("button");
                btnP.className = "damas-btn";
                btnP.textContent = "⚫ Jogar de Pretas";
                btnP.onclick = async () => {
                    const prontos = !!st.whiteId;
                    await salvarEstado({
                        ...st,
                        blackId: idUsuario,
                        blackName: nomeUsuario,
                        status: prontos ? "jogando" : "aguardando",
                        board: criarTabuleiroInicial(),
                        turn: "brancas"
                    });
                    if (prontos) {
                        await anunciarNoChat(
                            `Partida de Damas iniciada: ${formatarNome(st.whiteName)} (⚪) vs ${formatarNome(nomeUsuario)} (⚫)!`
                        );
                    }
                };
                actionsEl.appendChild(btnP);
            }

            if (souBrancas || souPretas) {
                const btnSairMesa = document.createElement("button");
                btnSairMesa.className = "damas-btn secondary";
                btnSairMesa.textContent = "Sair da mesa";
                btnSairMesa.onclick = async () => {
                    // Se estava jogando, ao sair volta para "aguardando"
                    const novoStatus = st.status === "jogando" ? "aguardando" : st.status;
                    await salvarEstado({
                        ...st,
                        whiteId:   souBrancas ? "" : st.whiteId,
                        whiteName: souBrancas ? "" : st.whiteName,
                        blackId:   souPretas  ? "" : st.blackId,
                        blackName: souPretas  ? "" : st.blackName,
                        status:    novoStatus,
                        turn: "brancas",
                        mustContinueFrom: null
                    });
                };
                actionsEl.appendChild(btnSairMesa);
            }
        }

        if (st.status === "jogando" && (souBrancas || souPretas)) {
            const btnDesistir = document.createElement("button");
            btnDesistir.className = "damas-btn danger";
            btnDesistir.textContent = "🏳️ Desistir";
            btnDesistir.onclick = async () => {
                if (!confirm("Tem certeza que deseja desistir da partida?")) return;
                const vencedor = souBrancas ? st.blackName : st.whiteName;
                await salvarEstado({
                    ...st,
                    status: "finalizado",
                    winner: vencedor,
                    mustContinueFrom: null
                });
                await anunciarNoChat(
                    `${formatarNome(nomeUsuario)} desistiu! ${formatarNome(vencedor)} venceu nas Damas! 🏆`
                );
            };
            actionsEl.appendChild(btnDesistir);
        }

        // Também permite sair da mesa durante a partida
        if (st.status === "jogando" && (souBrancas || souPretas)) {
            const btnSairMesa = document.createElement("button");
            btnSairMesa.className = "damas-btn secondary";
            btnSairMesa.textContent = "Sair da mesa";
            btnSairMesa.onclick = async () => {
                const vencedor = souBrancas ? st.blackName : st.whiteName;
                await salvarEstado({
                    ...st,
                    whiteId:   souBrancas ? "" : st.whiteId,
                    whiteName: souBrancas ? "" : st.whiteName,
                    blackId:   souPretas  ? "" : st.blackId,
                    blackName: souPretas  ? "" : st.blackName,
                    status:    "finalizado",
                    winner:    vencedor,
                    mustContinueFrom: null
                });
                await anunciarNoChat(
                    `${formatarNome(nomeUsuario)} saiu da partida. ${formatarNome(vencedor)} venceu nas Damas! 🏆`
                );
            };
            actionsEl.appendChild(btnSairMesa);
        }

            if (st.status === "finalizado" || user?.isAdmin || user?.isModerator || user?.isGuardian || user?.isHelper) {
            const btnReset = document.createElement("button");
            btnReset.className = "damas-btn secondary";
            btnReset.textContent = "🔄 Nova Mesa";
            btnReset.onclick = async () => {
                selectedIdx = null;
                try {
                    await deleteDoc(jogoRef);
                } catch (e) {
                    console.error("Erro ao resetar mesa:", e);
                }
            };
            actionsEl.appendChild(btnReset);
        }
    };

    // Listener em tempo real com detecção de sons
    if (unsubDamas) unsubDamas();
    unsubDamas = onSnapshot(
        jogoRef,
        (docSnap) => {
            const estadoAnterior = estadoAtual;
            const novoEstado = docSnap.exists() ? docSnap.data() : null;

            if (estadoAnterior && novoEstado) {
                // 1. Verifica vitória
                if (estadoAnterior.status === "jogando" && novoEstado.status === "finalizado" && novoEstado.winner) {
                    tocarSomDamas("vitoria");
                } 
                // 2. Verifica se alguma peça acabou de virar Dama (2 = dama branca, 4 = dama preta)
                else if (Array.isArray(estadoAnterior.board) && Array.isArray(novoEstado.board)) {
                    const damasAntes = estadoAnterior.board.filter((p) => p === 2 || p === 4).length;
                    const damasDepois = novoEstado.board.filter((p) => p === 2 || p === 4).length;

                    if (damasDepois > damasAntes) {
                        tocarSomDamas("dama");
                    } else if (estadoAnterior.board.join(",") !== novoEstado.board.join(",")) {
                        tocarSomDamas("mover");
                    }
                }
            }

            estadoAtual = novoEstado;
            renderizar();
        },
        (err) => {
            console.error("Erro no listener das damas:", err);
        }
    );
};