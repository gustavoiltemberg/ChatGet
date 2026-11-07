(() => {
    // 1. Aguarda o botão do chat aparecer na tela
    const configurarCarrosselTemas = setInterval(() => {
        const toggleBtn = document.querySelector("#chat-theme-toggle");
        
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

            // 2. Ação de clique do botão do chat
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
                // CASO 4: Modo Azul -> Verde
                else if (document.body.classList.contains("blue-theme")) {
                    document.body.classList.remove("blue-theme");
                    document.body.classList.add("green-theme");
                    toggleBtn.textContent = "🍀";
                    localStorage.setItem("chat-tema", "green");
                }
                // CASO 5: Modo Verde -> Volta para o Escuro
                else if (document.body.classList.contains("green-theme")) {
                    document.body.classList.remove("green-theme");
                    toggleBtn.textContent = "🌙";
                    localStorage.setItem("chat-tema", "dark");
                }

                // 🔑 MÁGICA EXTRA: Sincroniza o emoji do botão da tela de login (que está escondido)
                const loginBtn = document.querySelector(".login #manual-theme-toggle");
                if (loginBtn) loginBtn.textContent = toggleBtn.textContent;
            });
        }
    }, 50);
})();