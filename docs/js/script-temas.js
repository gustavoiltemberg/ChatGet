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

    // 2. Aguarda os botões aparecerem na tela
    const configurarCarrosselTemas = setInterval(() => {
        // 🔑 Busca TODOS os botões de tema (tanto do chat quanto do login)
        const toggleBtns = document.querySelectorAll("#manual-theme-toggle, .chat-theme-btn, .theme-toggle-btn");
        
        if (toggleBtns.length > 0) {
            clearInterval(configurarCarrosselTemas); // Para o timer

            // Função auxiliar para atualizar o emoji em TODOS os botões encontrados
            const atualizarEmojis = (emoji) => {
                toggleBtns.forEach(btn => btn.textContent = emoji);
            };

            // Ajusta o emoji inicial baseado no tema que estava salvo
            if (document.body.classList.contains("light-theme")) {
                atualizarEmojis("☀️");
            } else if (document.body.classList.contains("pink-theme")) {
                atualizarEmojis("🌸");
            } else if (document.body.classList.contains("blue-theme")) {
                atualizarEmojis("💎");
            } else if (document.body.classList.contains("green-theme")) {
                atualizarEmojis("🍀");
            } else {
                atualizarEmojis("🌙");
            }

            // 3. Configura a ação de clique cíclico para cada botão
            toggleBtns.forEach(toggleBtn => {
                toggleBtn.addEventListener("click", (e) => {
                    e.preventDefault();

                    // CASO 1: Modo Escuro -> Claro
                    if (!document.body.classList.contains("light-theme") && !document.body.classList.contains("pink-theme") && !document.body.classList.contains("blue-theme") && !document.body.classList.contains("green-theme")) {
                        document.body.classList.add("light-theme");
                        atualizarEmojis("☀️");
                        localStorage.setItem("chat-tema", "light");
                    }
                    // CASO 2: Modo Claro -> Rosa
                    else if (document.body.classList.contains("light-theme")) {
                        document.body.classList.remove("light-theme");
                        document.body.classList.add("pink-theme");
                        atualizarEmojis("🌸");
                        localStorage.setItem("chat-tema", "pink");
                    }
                    // CASO 3: Modo Rosa -> Azul
                    else if (document.body.classList.contains("pink-theme")) {
                        document.body.classList.remove("pink-theme");
                        document.body.classList.add("blue-theme");
                        atualizarEmojis("💎");
                        localStorage.setItem("chat-tema", "blue");
                    }
                    // CASO 4: Modo Azul -> Verde
                    else if (document.body.classList.contains("blue-theme")) {
                        document.body.classList.remove("blue-theme");
                        document.body.classList.add("green-theme");
                        atualizarEmojis("🍀");
                        localStorage.setItem("chat-tema", "green");
                    }
                    // CASO 5: Modo Verde -> Volta para o Escuro Padrão
                    else if (document.body.classList.contains("green-theme")) {
                        document.body.classList.remove("green-theme");
                        atualizarEmojis("🌙");
                        localStorage.setItem("chat-tema", "dark");
                    }
                });
            });
        }
    }, 50);
})();