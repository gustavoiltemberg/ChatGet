(() => {
    // 1. Aplica o tema imediatamente ao carregar a página (evita piscada escura)
    const temaSalvo = localStorage.getItem("chat-tema");
    if (temaSalvo === "light") {
        document.body.classList.add("light-theme");
    }

    // 2. Aguarda o botão aparecer na tela para configurar o clique
    const configurarBotao = setInterval(() => {
        const toggleBtn = document.querySelector("#manual-theme-toggle");
        
        if (toggleBtn) {
            clearInterval(configurarBotao); // Para o timer

            // Ajusta o texto inicial baseado no tema atual
            if (document.body.classList.contains("light-theme")) {
                toggleBtn.textContent = "☀️";
            }

            // Configura a ação de clique
            toggleBtn.addEventListener("click", () => {
                const isLight = document.body.classList.toggle("light-theme");
                
                if (isLight) {
                    toggleBtn.textContent = "☀️";
                    localStorage.setItem("chat-tema", "light");
                } else {
                    toggleBtn.textContent = "🌙";
                    localStorage.setItem("chat-tema", "dark");
                }
            });
        }
    }, 50);
})();
