(() => {
    // 1. Aplica o tema salvo imediatamente ao carregar a página
    const temaSalvo = localStorage.getItem("chat-tema");
    if (temaSalvo === "light") {
        document.body.classList.add("light-theme");
    } else if (temaSalvo === "pink") {
        document.body.classList.add("pink-theme");
    }

    // 2. Aguarda o botão aparecer na tela para configurar o clique cíclico
    const configurarCarrosselTemas = setInterval(() => {
        const toggleBtn = document.querySelector("#manual-theme-toggle");
        
        if (toggleBtn) {
            clearInterval(configurarCarrosselTemas); // Para o timer

            // Ajusta o emoji inicial baseado no tema que estava salvo
            if (document.body.classList.contains("light-theme")) {
                toggleBtn.textContent = "☀️";
            } else if (document.body.classList.contains("pink-theme")) {
                toggleBtn.textContent = "🌸";
            } else {
                toggleBtn.textContent = "🌙";
            }

            // 3. Configura a ação de clique cíclico
            toggleBtn.addEventListener("click", (e) => {
                e.preventDefault();

                // CASO 1: Está no Modo Escuro (corpo não tem classe light nem pink) -> Vai para o Claro
                if (!document.body.classList.contains("light-theme") && !document.body.classList.contains("pink-theme")) {
                    document.body.classList.add("light-theme"); // Ativa o claro
                    toggleBtn.textContent = "☀️";
                    localStorage.setItem("chat-tema", "light");
                }
                // CASO 2: Está no Modo Claro -> Vai para o Rosa
                else if (document.body.classList.contains("light-theme")) {
                    document.body.classList.remove("light-theme"); // Desativa o claro
                    document.body.classList.add("pink-theme");     // Ativa o rosa
                    toggleBtn.textContent = "🌸";
                    localStorage.setItem("chat-tema", "pink");
                }
                // CASO 3: Está no Modo Rosa -> Volta para o Escuro
                else if (document.body.classList.contains("pink-theme")) {
                    document.body.classList.remove("pink-theme");  // Desativa o rosa (volta ao padrão escuro)
                    toggleBtn.textContent = "🌙";
                    localStorage.setItem("chat-tema", "dark");
                }
            });
        }
    }, 50);
})();