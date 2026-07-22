export class UIController {
    constructor({ rootId = 'ai-assistant-root' } = {}) {
        this.rootId = rootId;
        this.root = null;
        this.elements = {};
        this.events = {};
    }

    mount() {
        this.root = document.getElementById(this.rootId);

        if (!this.root) {
            this.root = document.createElement('div');
            this.root.id = this.rootId;
            document.body.appendChild(this.root);
        }

        this.root.className = 'ai-assistant';
        this.root.innerHTML = this.template();
        this.cacheElements();
        return this.root;
    }

    template() {
        return `
            <button class="ai-launcher" type="button" data-ai-action="toggle" aria-label="Abrir Assistente IA" title="Assistente IA">
                <span class="ai-launcher__mark" aria-hidden="true">IA</span>
                <span class="ai-launcher__status" aria-hidden="true"></span>
            </button>

            <section class="ai-shell" role="dialog" aria-modal="false" aria-labelledby="ai-assistant-title" aria-hidden="true">
                <header class="ai-header">
                    <div class="ai-header__identity">
                        <div class="ai-avatar" aria-hidden="true">IA</div>
                        <div>
                            <h2 id="ai-assistant-title">Assistente IA</h2>
                            <p><span class="ai-online-dot" aria-hidden="true"></span><span data-ai-context>Modo Público</span></p>
                        </div>
                    </div>

                    <div class="ai-header__actions">
                        <label class="ai-theme-select">
                            <span class="sr-only">Tema</span>
                            <select data-ai-theme aria-label="Tema do assistente">
                                <option value="system">Sistema</option>
                                <option value="light">Claro</option>
                                <option value="dark">Escuro</option>
                            </select>
                        </label>
                        <button class="ai-icon-button" type="button" data-ai-action="copy-last" aria-label="Copiar última resposta" title="Copiar última resposta">Copiar</button>
                        <button class="ai-icon-button" type="button" data-ai-action="new" aria-label="Nova conversa" title="Nova conversa">Nova</button>
                        <button class="ai-icon-button" type="button" data-ai-action="clear" aria-label="Limpar conversa" title="Limpar conversa">Limpar</button>
                        <button class="ai-icon-button" type="button" data-ai-action="export" aria-label="Exportar conversa" title="Exportar conversa">Exportar</button>
                        <button class="ai-icon-button ai-dev-button" type="button" data-ai-action="dev" aria-label="Abrir Developer Dashboard" title="Developer Dashboard" hidden>Dev</button>
                        <button class="ai-icon-button" type="button" data-ai-action="close" aria-label="Fechar assistente" title="Fechar">X</button>
                    </div>
                </header>

                <div class="ai-body">
                    <aside class="ai-side-menu" aria-label="Sugestões do assistente">
                        <div class="ai-side-menu__header">
                            <strong>Sugestões</strong>
                        </div>
                        <div class="ai-suggestion-list" data-ai-suggestions></div>
                    </aside>

                    <main class="ai-chat" aria-label="Conversa com o Assistente IA">
                        <div class="ai-messages" data-ai-messages role="log" aria-live="polite" aria-relevant="additions"></div>

                        <div class="ai-typing" data-ai-typing hidden>
                            <span></span><span></span><span></span>
                            <p>digitando...</p>
                        </div>

                        <form class="ai-composer" data-ai-form>
                            <label class="sr-only" for="ai-input">Mensagem para o Assistente IA</label>
                            <textarea id="ai-input" data-ai-input rows="1" maxlength="800" placeholder="Pergunte sobre o Blog Secreto..."></textarea>
                            <div class="ai-composer__actions">
                                <button class="ai-stop-button" type="button" data-ai-action="stop" hidden>Parar</button>
                                <button class="ai-send-button" type="submit">Enviar</button>
                            </div>
                        </form>
                    </main>

                    <aside class="ai-dev-dashboard" data-ai-dev-dashboard aria-label="Developer Dashboard" hidden>
                        <div class="ai-dev-dashboard__header">
                            <div>
                                <strong>Developer Dashboard</strong>
                                <span data-ai-dev-status>Local</span>
                            </div>
                            <button class="ai-icon-button" type="button" data-ai-action="close-dev" aria-label="Fechar Developer Dashboard">X</button>
                        </div>
                        <div class="ai-dev-dashboard__content" data-ai-dev-content></div>
                    </aside>
                </div>
            </section>
        `;
    }

    cacheElements() {
        this.elements = {
            launcher: this.root.querySelector('.ai-launcher'),
            shell: this.root.querySelector('.ai-shell'),
            context: this.root.querySelector('[data-ai-context]'),
            form: this.root.querySelector('[data-ai-form]'),
            input: this.root.querySelector('[data-ai-input]'),
            messages: this.root.querySelector('[data-ai-messages]'),
            typing: this.root.querySelector('[data-ai-typing]'),
            suggestions: this.root.querySelector('[data-ai-suggestions]'),
            theme: this.root.querySelector('[data-ai-theme]'),
            stopButton: this.root.querySelector('[data-ai-action="stop"]'),
            sendButton: this.root.querySelector('.ai-send-button'),
            devButton: this.root.querySelector('[data-ai-action="dev"]'),
            devDashboard: this.root.querySelector('[data-ai-dev-dashboard]'),
            devContent: this.root.querySelector('[data-ai-dev-content]'),
            devStatus: this.root.querySelector('[data-ai-dev-status]')
        };
    }

    bindEvents(events) {
        this.events = events;

        this.root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-ai-action]');
            if (!button) return;

            const action = button.dataset.aiAction;
            this.handleAction(action);
        });

        this.elements.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.events.onSend?.(this.elements.input.value);
        });

        this.elements.input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.events.onSend?.(this.elements.input.value);
            }
        });

        this.elements.input.addEventListener('input', () => {
            this.autoResizeInput();
            this.root.dataset.aiInputEmpty = this.elements.input.value.trim() ? 'false' : 'true';
        });

        this.elements.theme.addEventListener('change', () => {
            this.events.onThemeChange?.(this.elements.theme.value);
        });

        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                this.open();
            }

            if (event.key === 'Escape') {
                if (this.root.dataset.aiDevOpen === 'true') {
                    this.closeDeveloperDashboard();
                    return;
                }

                if (this.root.dataset.aiOpen === 'true') {
                    this.close();
                }
            }
        });
    }

    handleAction(action) {
        const actionMap = {
            toggle: () => this.toggle(),
            close: () => this.close(),
            clear: () => this.events.onClear?.(),
            new: () => this.events.onNewConversation?.(),
            export: () => this.events.onExport?.(),
            stop: () => this.events.onStop?.(),
            dev: () => this.events.onOpenDeveloperDashboard?.(),
            'close-dev': () => this.closeDeveloperDashboard(),
            'copy-last': () => this.events.onCopyLast?.()
        };

        actionMap[action]?.();
    }

    setContext({ label, isAdmin }) {
        this.elements.context.textContent = label;
        this.root.dataset.aiContext = isAdmin ? 'admin' : 'public';
        this.elements.devButton.hidden = !isAdmin;
    }

    setThemeValue(theme) {
        this.elements.theme.value = theme;
    }

    setSuggestions(suggestions = []) {
        this.elements.suggestions.replaceChildren();

        suggestions.forEach((suggestion) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ai-suggestion';
            button.textContent = suggestion.label;
            button.addEventListener('click', () => this.events.onSuggestion?.(suggestion.value));
            this.elements.suggestions.appendChild(button);
        });
    }

    setBusy(isBusy) {
        this.elements.sendButton.disabled = isBusy;
        this.elements.stopButton.hidden = !isBusy;
        this.root.dataset.aiBusy = isBusy ? 'true' : 'false';
    }

    clearInput() {
        this.elements.input.value = '';
        this.autoResizeInput();
        this.root.dataset.aiInputEmpty = 'true';
    }

    focusInput() {
        this.elements.input.focus({ preventScroll: true });
    }

    open() {
        this.root.dataset.aiOpen = 'true';
        this.elements.shell.setAttribute('aria-hidden', 'false');
        document.documentElement.dataset.aiAssistantOpen = 'true';
        this.focusInput();
    }

    close() {
        this.root.dataset.aiOpen = 'false';
        this.elements.shell.setAttribute('aria-hidden', 'true');
        document.documentElement.removeAttribute('data-ai-assistant-open');
        this.closeDeveloperDashboard();
    }

    toggle() {
        if (this.root.dataset.aiOpen === 'true') {
            this.close();
            return;
        }

        this.open();
    }

    openDeveloperDashboard() {
        this.elements.devDashboard.hidden = false;
        this.root.dataset.aiDevOpen = 'true';
    }

    closeDeveloperDashboard() {
        this.elements.devDashboard.hidden = true;
        this.root.dataset.aiDevOpen = 'false';
    }

    setDeveloperDashboardContent(node) {
        this.elements.devContent.replaceChildren(node);
        this.elements.devStatus.textContent = 'Atualizado';
    }

    download(filename, content, mimeType = 'application/json') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    autoResizeInput() {
        const input = this.elements.input;
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
    }
}
