/**
 * System Theme Manager (Vanilla JS)
 * Gerencia a alternância entre os temas Claro e Escuro com suporte a LocalStorage
 */

(function () {
    const THEME_KEY = 'blog_secreto_theme';
    const LIGHT = 'light';
    const DARK = 'dark';

    // 1. Recuperar tema salvo ou utilizar 'light' por defeito
    const savedTheme = localStorage.getItem(THEME_KEY) || LIGHT;

    // 2. Aplicar imediatamente na tag <html> para evitar FOUC (Flash of Unstyled Content)
    document.documentElement.setAttribute('data-theme', savedTheme);

    class ThemeController {
        constructor() {
            this.currentTheme = savedTheme;
            this.button = null;

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }

        init() {
            this.injectButton();
        }

        injectButton() {
            const navUl = document.querySelector('nav ul');
            if (!navUl) return;

            const li = document.createElement('li');
            this.button = document.createElement('button');
            this.button.className = 'theme-toggle-btn';
            this.button.setAttribute('aria-label', 'Alternar tema');
            this.button.setAttribute('type', 'button');

            this.updateIcon();

            this.button.addEventListener('click', () => this.toggle());
            li.appendChild(this.button);
            navUl.appendChild(li);
        }

        toggle() {
            document.body.classList.add('theme-transitioning');

            this.currentTheme = this.currentTheme === LIGHT ? DARK : LIGHT;
            document.documentElement.setAttribute('data-theme', this.currentTheme);
            localStorage.setItem(THEME_KEY, this.currentTheme);

            this.updateIcon();

            setTimeout(() => {
                document.body.classList.remove('theme-transitioning');
            }, 350);
        }

        updateIcon() {
            if (!this.button) return;
            // Mostra o ícone da lua no tema claro e do sol no tema escuro
            const icon = this.currentTheme === LIGHT ? '🌙' : '☀️';
            this.button.innerHTML = `<span>${icon}</span>`;
        }
    }

    new ThemeController();
})();