import { PermissionManager } from './PermissionManager.js';
import { SecurityManager } from './SecurityManager.js';
import { LocalSearchProvider } from '../providers/LocalProvider.js';
import { StorageManager } from '../services/StorageManager.js';
import { ApiService } from '../services/ApiService.js';
import { IntentRecognizer } from './IntentRecognizer.js';
import { SearchEngine } from './SearchEngine.js';
import { ConversationMemory } from './ConversationMemory.js';
import { UIController } from '../ui/UIController.js';
import { MessageRenderer } from '../ui/MessageRenderer.js';
import { ThemeManager } from './ThemeManager.js';
import { ResponsiveManager } from './ResponsiveManager.js';
import { DeveloperMode } from './DeveloperMode.js';

export class ChatManager {
    constructor(options = {}) {
        this.options = options;
        this.storage = options.storage || new StorageManager();
        this.permissions = new PermissionManager();
        this.intentRecognizer = new IntentRecognizer();
        this.searchEngine = new SearchEngine();
        this.api = new ApiService({
            storage: this.storage,
            useRemote: Boolean(options.useRemoteApi)
        });
        this.memory = new ConversationMemory(this.storage);
        this.provider = options.provider || new LocalSearchProvider({
            apiService: this.api,
            searchEngine: this.searchEngine,
            intentRecognizer: this.intentRecognizer
        });
        this.ui = new UIController();
        this.theme = new ThemeManager(this.storage);
        this.responsive = new ResponsiveManager();
        this.developerMode = new DeveloperMode({
            apiService: this.api,
            storageManager: this.storage
        });
        this.renderer = null;
        this.abortController = null;
        this.lastAssistantText = '';
    }

    async init() {
        const root = this.ui.mount();
        this.theme.attach(root);
        this.responsive.attach(root);
        this.ui.setThemeValue(this.theme.getTheme());
        this.ui.setContext({
            label: this.permissions.getModeLabel(),
            isAdmin: this.permissions.isAdmin
        });

        this.renderer = new MessageRenderer({
            messagesEl: this.ui.elements.messages,
            typingEl: this.ui.elements.typing,
            onAction: (action) => this.executeAction(action),
            onCopy: (text) => this.copyText(text)
        });

        this.ui.bindEvents({
            onSend: (text) => this.handleSend(text),
            onSuggestion: (text) => this.handleSuggestion(text),
            onClear: () => this.clearConversation(),
            onNewConversation: () => this.newConversation(),
            onExport: () => this.exportConversation(),
            onStop: () => this.stopGeneration(),
            onCopyLast: () => this.copyLastResponse(),
            onThemeChange: (theme) => this.theme.setTheme(theme),
            onOpenDeveloperDashboard: () => this.openDeveloperDashboard()
        });

        this.renderer.renderMessages(this.memory.getMessages());
        this.ui.setSuggestions(this.permissions.filterSuggestions(
            this.intentRecognizer.getSuggestions({ isAdmin: this.permissions.isAdmin })
        ));

        if (!this.memory.getMessages().length) {
            this.renderWelcome();
        }

        await this.handlePendingAdminAction();
    }

    async handleSend(rawText) {
        let text = '';

        try {
            text = SecurityManager.validateMessage(rawText);
            SecurityManager.validateRateLimit(this.storage);
            this.storage.recordRequestTimestamp();
        } catch (error) {
            this.renderer.appendSystem(error.message);
            return;
        }

        const userMessage = this.memory.addMessage('user', { text });
        this.renderer.appendMessage(userMessage);
        this.ui.clearInput();
        this.ui.setBusy(true);
        this.renderer.showTyping(true);
        this.abortController = new AbortController();

        try {
            await this.wait(220, this.abortController.signal);

            const response = await this.provider.generate(text, {
                isAdmin: this.permissions.isAdmin,
                isAdminPath: this.permissions.isAdminPath,
                systemPrompt: this.permissions.getSystemPrompt(),
                memory: this.memory.getContext(),
                route: window.location.pathname
            });

            if (this.abortController.signal.aborted) return;

            await this.handleResponse(response, text);
        } catch (error) {
            if (error.name === 'AbortError') {
                this.renderer.appendSystem('Geração interrompida.');
            } else {
                console.error('[Assistente IA]', error);
                this.renderer.appendSystem('Erro ao processar a mensagem. Tente novamente.');
                this.storage.addLog({
                    category: 'ERROR',
                    user: this.permissions.isAdmin ? 'admin' : 'public',
                    message: error.message,
                    query: text
                });
            }
        } finally {
            this.renderer.showTyping(false);
            this.ui.setBusy(false);
            this.abortController = null;
        }
    }

    async handleResponse(response, query) {
        const normalizedResponse = this.provider.normalizeResponse(response);

        if (!this.permissions.isAdmin && SecurityManager.isAdminOnlyTopic(query)) {
            normalizedResponse.text = SecurityManager.redactPublicText(normalizedResponse.text);
        }

        const assistantMessage = this.memory.addMessage('assistant', normalizedResponse);
        this.lastAssistantText = assistantMessage.text;
        this.renderer.appendMessage(assistantMessage);
        this.memory.rememberInteraction(normalizedResponse.meta?.intent || 'search', normalizedResponse.results);

        this.storage.addLog({
            category: normalizedResponse.meta?.blocked ? 'SECURITY' : 'INFO',
            user: this.permissions.isAdmin ? 'admin' : 'public',
            message: `Intent: ${normalizedResponse.meta?.intent || 'unknown'}`,
            query
        });

        if (normalizedResponse.meta?.openDeveloperDashboard) {
            await this.openDeveloperDashboard();
        }

        if (normalizedResponse.meta?.autoExecuteAction) {
            const action = normalizedResponse.actions.find((entry) => entry.type === normalizedResponse.meta.autoExecuteAction);
            if (action) this.executeAction(action);
        }
    }

    handleSuggestion(text) {
        this.ui.open();
        this.ui.elements.input.value = text;
        this.ui.autoResizeInput();
        this.handleSend(text);
    }

    renderWelcome() {
        const text = this.permissions.isAdmin
            ? 'Olá. Estou no modo administrador do Blog Secreto. Posso pesquisar o conteúdo público e também ajudar com status, logs, APIs preparadas e navegação do painel.'
            : 'Olá. Sou o Assistente IA do Blog Secreto. Posso pesquisar projetos, páginas, categorias, tags, galeria e novidades usando os dados públicos do site.';

        const welcome = {
            id: SecurityManager.createId('welcome'),
            role: 'assistant',
            text,
            timestamp: new Date().toISOString(),
            results: [],
            actions: [],
            meta: { welcome: true }
        };

        this.lastAssistantText = text;
        this.renderer.appendMessage(welcome);
    }

    async openDeveloperDashboard() {
        if (!this.permissions.isAdmin) {
            this.renderer.appendSystem('Developer Dashboard restrito ao administrador autenticado.');
            return;
        }

        this.ui.open();
        this.ui.openDeveloperDashboard();
        const content = await this.developerMode.render(this.ui.elements.devContent);
        this.ui.setDeveloperDashboardContent(content);
    }

    executeAction(action) {
        if (!action) return;

        if (action.type === 'open_dev_dashboard') {
            this.openDeveloperDashboard();
            return;
        }

        if (action.type === 'admin_new_project') {
            if (!this.permissions.isAdmin) {
                this.renderer.appendSystem('Ação restrita ao administrador.');
                return;
            }

            if (this.isCurrentAdminPage('projetos.html') && typeof window.abrirModalNovo === 'function') {
                this.ui.open();
                window.abrirModalNovo();
                return;
            }

            this.navigate('/admin/projetos.html?assistantAction=newProject');
            return;
        }

        if (action.type === 'navigate') {
            this.navigate(action.href);
        }
    }

    navigate(href) {
        const safeHref = SecurityManager.safeUrl(href);
        if (safeHref === '#') return;

        window.location.href = this.toRelativeHref(safeHref);
    }

    toRelativeHref(href) {
        if (/^(https?:|mailto:|file:)/i.test(href) || href.startsWith('#')) {
            return href;
        }

        const clean = href.replace(/^\//, '');
        const path = window.location.pathname;

        if (path.includes('/admin/')) {
            if (clean.startsWith('admin/')) return clean.replace(/^admin\//, '');
            return `../${clean}`;
        }

        if (path.includes('/pages/')) {
            return `../${clean}`;
        }

        return `./${clean}`;
    }

    isCurrentAdminPage(pageName) {
        return this.permissions.isAdmin && window.location.pathname.endsWith(`/admin/${pageName}`);
    }

    async handlePendingAdminAction() {
        if (!this.permissions.isAdmin) return;

        const params = new URLSearchParams(window.location.search);
        const action = params.get('assistantAction');

        if (action === 'newProject') {
            this.ui.open();
            this.renderer.appendSystem('Abrindo formulário de novo projeto.');
            await this.wait(120);
            if (typeof window.abrirModalNovo === 'function') {
                window.abrirModalNovo();
            }

            params.delete('assistantAction');
            const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', nextUrl);
        }
    }

    clearConversation() {
        this.memory.clear();
        this.renderer.clear();
        this.renderWelcome();
    }

    newConversation() {
        this.memory.newConversation();
        this.renderer.clear();
        this.renderWelcome();
        this.ui.focusInput();
    }

    exportConversation() {
        const filename = `blog-secreto-conversa-${new Date().toISOString().slice(0, 10)}.json`;
        this.ui.download(filename, this.storage.exportConversation());
    }

    stopGeneration() {
        this.abortController?.abort();
        this.renderer.showTyping(false);
        this.ui.setBusy(false);
    }

    async copyLastResponse() {
        if (!this.lastAssistantText) {
            const messages = this.memory.getMessages().filter((message) => message.role === 'assistant');
            this.lastAssistantText = messages.at(-1)?.text || '';
        }

        if (!this.lastAssistantText) {
            this.renderer.appendSystem('Nenhuma resposta para copiar.');
            return;
        }

        await this.copyText(this.lastAssistantText);
    }

    async copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.renderer.appendSystem('Resposta copiada.');
        } catch (error) {
            this.renderer.appendSystem('Não foi possível copiar pelo navegador.');
        }
    }

    wait(ms, signal) {
        return new Promise((resolve, reject) => {
            const timeout = window.setTimeout(resolve, ms);
            if (!signal) return;

            signal.addEventListener('abort', () => {
                window.clearTimeout(timeout);
                reject(new DOMException('Abortado', 'AbortError'));
            }, { once: true });
        });
    }
}

function bootstrapAssistant() {
    if (window.__BlogSecretoAssistant) return;
    window.__BlogSecretoAssistant = new ChatManager();
    window.__BlogSecretoAssistant.init().catch((error) => {
        console.error('[Assistente IA] Falha ao inicializar:', error);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAssistant);
} else {
    bootstrapAssistant();
}
