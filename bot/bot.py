import os
import json
import time
import random
from collections import defaultdict
import firebase_admin
from firebase_admin import credentials, firestore

# ================= CONEXÃO SEGURA COM O FIREBASE =================
chave_env = os.environ.get("FIREBASE_KEY")

if chave_env:
    # Quando rodar na nuvem (Render, Koyeb, etc.), lê a variável de ambiente
    cred_dict = json.loads(chave_env)
    cred = credentials.Certificate(cred_dict)
else:
    # Quando rodar no seu PC, procura 'chave-firebase.json' na mesma pasta do bot.py
    pasta_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_chave = os.path.join(pasta_atual, "chave-firebase.json")
    cred = credentials.Certificate(caminho_chave)

firebase_admin.initialize_app(cred)
db = firestore.client()

# Marca o exato momento em que o bot ligou (evita responder mensagens antigas)
INICIO_BOT = int(time.time() * 1000)

# ================= CONFIGURAÇÕES DE MODERAÇÃO =================
PALAVRAS_PROIBIDAS = ["palavrao1", "palavrao2", "ofensa"]  # Coloque suas palavras aqui
LIMITE_SPAM = 5       # Máximo de mensagens permitidas...
JANELA_SPAM = 5       # ...dentro de 5 segundos
historico_mensagens = defaultdict(list)


# ================= FUNÇÕES DO BOT =================
def enviar_mensagem_bot(texto):
    """Envia uma mensagem no chat usando o visual de Moderador do seu CSS."""
    db.collection("mensagens").add({
        "userId": "bot-python",
        "userName": "Bot",
        "userColor": "cadetblue",
        "isModerator": True,
        "content": texto,
        "timestamp": int(time.time() * 1000)
    })


def banir_usuario(nome_usuario, motivo):
    """Adiciona o usuário na coleção 'banidos' do seu chat."""
    nome_limpo = nome_usuario.strip().lower()
    if nome_limpo == "admin":
        return

    db.collection("banidos").document(nome_limpo).set({"banido": True})
    enviar_mensagem_bot(
        f"🚫 O usuário {nome_usuario.capitalize()} foi banido. Motivo: {motivo}."
    )


def desbanir_usuario(nome_usuario):
    """Remove o usuário da coleção 'banidos'."""
    nome_limpo = nome_usuario.strip().lower()
    db.collection("banidos").document(nome_limpo).delete()
    enviar_mensagem_bot(f"✅ O usuário {nome_usuario.capitalize()} foi desbanido.")


def limpar_chat():
    """Apaga todas as mensagens da coleção 'mensagens'."""
    docs = db.collection("mensagens").stream()
    for doc in docs:
        doc.reference.delete()
    enviar_mensagem_bot("🧹 O chat foi limpo pela moderação.")


def pegar_usuarios_online():
    """Busca quem está ativo na coleção 'usuarios_online' (últimos 60 segundos)."""
    agora = int(time.time() * 1000)
    docs = db.collection("usuarios_online").stream()
    online = []
    for doc in docs:
        dados = doc.to_dict()
        nome = dados.get("name")
        ultima_atv = dados.get("ultimaAtividade", 0)
        if nome and (agora - ultima_atv <= 60000):
            online.append(nome.capitalize())
    return online


# ================= PROCESSAMENTO DE MENSAGENS =================
def processar_mensagem(doc_snap):
    dados = doc_snap.to_dict()

    # Ignora mensagens antigas, avisos de sistema e mensagens do próprio Bot
    if dados.get("timestamp", 0) < INICIO_BOT:
        return
    if dados.get("isSystem") or dados.get("userId") == "bot-python":
        return

    autor = dados.get("userName", "Anônimo")
    texto = dados.get("content", "").strip()
    texto_minusculo = texto.lower()

    # Verifica permissões (Admin ou Moderador)
    is_admin = (autor.lower() == "admin")
    is_mod = (dados.get("isModerator") is True)
    eh_equipe = is_admin or is_mod

    # 1. MODERAÇÃO AUTOMÁTICA (apenas para usuários comuns)
    if not eh_equipe:
        # Anti-Spam
        agora = time.time()
        historico_mensagens[autor] = [
            t for t in historico_mensagens[autor] if agora - t < JANELA_SPAM
        ]
        historico_mensagens[autor].append(agora)

        if len(historico_mensagens[autor]) > LIMITE_SPAM:
            doc_snap.reference.delete()
            banir_usuario(autor, "Spam excessivo no chat")
            return

        # Filtro de Palavrões
        if any(palavra in texto_minusculo for palavra in PALAVRAS_PROIBIDAS):
            doc_snap.reference.delete()
            enviar_mensagem_bot(
                f"⚠️ {autor.capitalize()}, sua mensagem foi removida por conter linguagem imprópria."
            )
            return

    # 2. COMANDOS PÚBLICOS (Todos podem usar)
    if texto_minusculo == "!ajuda":
        msg = "🤖 Comandos: !ajuda | !online | !dado"
        if eh_equipe:
            msg += " || 🛡️ Equipe: !sorteio | !aviso <msg> | !banir <nome> | !desbanir <nome> | !limpar"
        enviar_mensagem_bot(msg)

    elif texto_minusculo == "!online":
        usuarios = pegar_usuarios_online()
        lista = ", ".join(usuarios) if usuarios else "Ninguém"
        enviar_mensagem_bot(f"🟢 Online agora ({len(usuarios)}): {lista}")

    elif texto_minusculo == "!dado":
        numero = random.randint(1, 6)
        enviar_mensagem_bot(f"🎲 {autor.capitalize()} rolou o dado e tirou: {numero}")

    # 3. COMANDOS EXCLUSIVOS DA EQUIPE (Admin e Moderadores)
    elif texto_minusculo == "!sorteio":
        if not eh_equipe:
            enviar_mensagem_bot(f"🔒 {autor.capitalize()}, apenas Admin ou Moderadores podem iniciar sorteios.")
            return
        usuarios = pegar_usuarios_online()
        if usuarios:
            vencedor = random.choice(usuarios)
            enviar_mensagem_bot(f"🎉 O sorteado entre os usuários online foi: {vencedor}!")
        else:
            enviar_mensagem_bot("❌ Não há usuários online suficientes para o sorteio.")

    elif texto_minusculo.startswith("!aviso "):
        if not eh_equipe:
            enviar_mensagem_bot(f"🔒 {autor.capitalize()}, você não tem permissão para enviar avisos.")
            return
        mensagem_aviso = texto[7:].strip()
        if mensagem_aviso:
            doc_snap.reference.delete()  # Apaga o comando digitado e deixa só o aviso do Bot
            enviar_mensagem_bot(f"📢 AVISO: {mensagem_aviso}")

    elif texto_minusculo.startswith("!banir "):
        if not eh_equipe:
            enviar_mensagem_bot(f"🔒 {autor.capitalize()}, você não tem permissão para banir.")
            return
        alvo = texto[7:].strip()
        if alvo:
            banir_usuario(alvo, f"Banido por {autor.capitalize()}")

    elif texto_minusculo.startswith("!desbanir "):
        if not eh_equipe:
            enviar_mensagem_bot(f"🔒 {autor.capitalize()}, você não tem permissão para desbanir.")
            return
        alvo = texto[10:].strip()
        if alvo:
            desbanir_usuario(alvo)

    elif texto_minusculo == "!limpar":
        if not eh_equipe:
            enviar_mensagem_bot(f"🔒 {autor.capitalize()}, apenas Admin ou Moderadores podem limpar o chat.")
            return
        limpar_chat()


# ================= OUVINTE EM TEMPO REAL =================
def on_snapshot(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name == "ADDED":
            processar_mensagem(change.document)


print("🤖 Bot conectado ao Firebase e monitorando o chat... (Ctrl+C para parar)")
query_watch = db.collection("mensagens").on_snapshot(on_snapshot)

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\n🛑 Bot encerrado.")
