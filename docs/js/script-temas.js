(() => {
    // 1. Aplica o tema salvo imediatamente ao carregar a página
    const temaSalvo = localStorage.getItem("chat-tema");
    if (temaSalvo === "light") {
        document.body.classList.add("light-theme");
    } else if (temaSalvo === "pink") {
        document.body.classList.add("pink-theme");
    } else if (temaSalvo === "blue") {
        document.body.classList.add("blue-theme");
    } else if (temaSalvo === "green") {
        document.body.classList.add("green-theme");
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
            } else if (document.body.classList.contains("blue-theme")) {
                toggleBtn.textContent = "💎";
            } else if (document.body.classList.contains("green-theme")) {
                toggleBtn.textContent = "🍀";
            } else {
                toggleBtn.textContent = "🌙";
            }

            // 3. Configura a ação de clique cíclico (Carrossel)
            toggleBtn.addEventListener("click", (e) => {
                e.preventDefault();

                // CASO 1: Modo Escuro -> Claro
                if (!document.body.classList.contains("light-theme") && !document.body.classList.contains("pink-theme") && !document.body.classList.contains("blue-theme") && !document.body.classList.contains("green-theme")) {
                    document.body.classList.add("light-theme");
                    toggleBtn.textContent = "☀️";
                    localStorage.setItem("chat-tema", "light");
                }
                // CASO 2: Modo Claro -> Rosa
                else if (document.body.classList.contains("light-theme")) {
                    document.body.classList.remove("light-theme");
                    document.body.classList.add("pink-theme");
                    toggleBtn.textContent = "🌸";
                    localStorage.setItem("chat-tema", "pink");
                }
                // CASO 3: Modo Rosa -> Azul
                else if (document.body.classList.contains("pink-theme")) {
                    document.body.classList.remove("pink-theme");
                    document.body.classList.add("blue-theme");
                    toggleBtn.textContent = "💎";
                    localStorage.setItem("chat-tema", "blue");
                }
                // CASO 4: Modo Azul -> Verde 🍀 NOVO
                else if (document.body.classList.contains("blue-theme")) {
                    document.body.classList.remove("blue-theme");
                    document.body.classList.add("green-theme");
                    toggleBtn.textContent = "🍀";
                    localStorage.setItem("chat-tema", "green");
                }
                // CASO 5: Modo Verde -> Volta para o Escuro Padrão
                else if (document.body.classList.contains("green-theme")) {
                    document.body.classList.remove("green-theme");
                    toggleBtn.textContent = "🌙";
                    localStorage.setItem("chat-tema", "dark");
                }
            });
        }
    }, 50);
})();