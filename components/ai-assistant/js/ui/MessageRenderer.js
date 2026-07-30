import { SecurityManager } from '../core/SecurityManager.js';

/**
 * MessageRenderer - Renderiza mensagens, resultados e ações do chat
 * Suporta: texto formatado, cards de resultados, botões de ação contextuais, animação matrix
 */
export class MessageRenderer {
    constructor({ messagesEl, typingEl, onAction, onCopy }) {
        this.messagesEl = messagesEl;
        this.typingEl = typingEl;
        this.onAction = onAction;
        this.onCopy = onCopy;
    }

    renderMessages(messages = []) {
        this.messagesEl.replaceChildren();
        messages.forEach((message) => this.appendMessage(message));
        this.scrollToEnd();
    }

    appendMessage(message) {
        const node = document.createElement('article');
        node.className = `ai-message ai-message--${message.role}`;
        node.dataset.messageId = message.id;

        const avatar = document.createElement('div');
        avatar.className = 'ai-message__avatar';
        avatar.textContent = message.role === 'user' ? 'EU' : message.role === 'system' ? 'SYS' : 'IA';
        avatar.setAttribute('aria-hidden', 'true');

        const bubble = document.createElement('div');
        bubble.className = 'ai-message__bubble';

        const meta = document.createElement('div');
        meta.className = 'ai-message__meta';

        const name = document.createElement('span');
        name.textContent = message.role === 'user' ? 'Você' : message.role === 'system' ? 'Sistema' : 'Assistente IA';

        const time = document.createElement('time');
        time.dateTime = message.timestamp || new Date().toISOString();
        time.textContent = this.formatTime(message.timestamp);

        meta.append(name, time);

        if (message.role === 'assistant') {
            const copyButton = document.createElement('button');
            copyButton.className = 'ai-icon-button ai-message__copy';
            copyButton.type = 'button';
            copyButton.textContent = 'Copiar';
            copyButton.title = 'Copiar resposta do assistente';
            copyButton.setAttribute('aria-label', 'Copiar resposta do assistente');
            copyButton.addEventListener('click', () => this.onCopy(message.text));
            meta.append(copyButton);
        }

        const content = document.createElement('div');
        content.className = 'ai-message__content';
        this.renderText(content, message.text);

        bubble.append(meta, content);

        // Renderiza resultados (cards)
        if (Array.isArray(message.results) && message.results.length) {
            bubble.append(this.renderResults(message.results));
        }

        // Renderiza ações rápidas (botões contextuais)
        if (Array.isArray(message.actions) && message.actions.length) {
            const actionsEl = this.renderActions(message.actions);
            if (actionsEl) bubble.append(actionsEl);
        }

        // Animação matrix (easter egg)
        if (message.meta && message.meta.matrix) {
            bubble.append(this.renderMatrix());
        }

        node.append(avatar, bubble);
        this.messagesEl.appendChild(node);
        this.scrollToEnd();
    }

    appendSystem(text) {
        this.appendMessage({
            id: SecurityManager.createId('system'),
            role: 'system',
            text,
            timestamp: new Date().toISOString(),
            results: [],
            actions: [],
            meta: {}
        });
    }

    /**
     * Renderiza texto com formatação básica (parágrafos, listas, negrito)
     */
    renderText(container, text) {
        const lines = String(text || '').split('\n');
        let currentList = null;

        lines.forEach((line) => {
            const trimmed = line.trim();

            if (!trimmed) {
                currentList = null;
                return;
            }

            // Lista com bullet
            if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                if (!currentList) {
                    currentList = document.createElement('ul');
                    container.appendChild(currentList);
                }
                const item = document.createElement('li');
                item.textContent = trimmed.replace(/^[-•]\s*/, '');
                currentList.appendChild(item);
                return;
            }

            // Lista numerada
            if (/^\d+\.\s/.test(trimmed)) {
                if (!currentList) {
                    currentList = document.createElement('ol');
                    container.appendChild(currentList);
                }
                const item = document.createElement('li');
                item.textContent = trimmed.replace(/^\d+\.\s*/, '');
                currentList.appendChild(item);
                return;
            }

            currentList = null;
            const paragraph = document.createElement('p');
            // Suporta negrito simples com markdown **texto**
            const formatted = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            paragraph.innerHTML = formatted;
            container.appendChild(paragraph);
        });
    }

    /**
     * Renderiza cards de resultados de busca
     */
    renderResults(results) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ai-results';

        results.slice(0, 6).forEach((result) => {
            const card = document.createElement('article');
            card.className = 'ai-result-card';

            // Badge de tipo
            const label = document.createElement('span');
            label.className = 'ai-result-card__type';
            label.textContent = result.typeLabel || result.type || 'Conteúdo';

            // Título
            const title = document.createElement('h4');
            title.textContent = result.title || 'Sem título';

            // Descrição
            const description = document.createElement('p');
            description.textContent = result.description || 'Sem descrição cadastrada.';

            // Tags
            const tags = document.createElement('div');
            tags.className = 'ai-result-card__tags';
            (result.tags || []).slice(0, 5).forEach((tag) => {
                const chip = document.createElement('span');
                chip.textContent = tag;
                tags.appendChild(chip);
            });

            // Footer com botão de ação
            const footer = document.createElement('div');
            footer.className = 'ai-result-card__footer';

            if (result.href && result.href !== '#') {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'ai-link-button';
                button.textContent = 'Abrir';
                button.addEventListener('click', () => this.onAction({
                    type: 'navigate',
                    href: result.href,
                    label: `Abrir ${result.title}`
                }));
                footer.appendChild(button);
            }

            // Botão "Ver tecnologias" para projetos
            if (result.type === 'project' && result.tags?.length) {
                const techButton = document.createElement('button');
                techButton.type = 'button';
                techButton.className = 'ai-action-button ai-action-button--secondary';
                techButton.textContent = '🛠️ Tecnologias';
                techButton.addEventListener('click', () => this.onAction({
                    type: 'search',
                    payload: { query: `tecnologias do ${result.title}` },
                    label: `Ver tecnologias do ${result.title}`
                }));
                footer.appendChild(techButton);
            }

            card.append(label, title, description);
            if (tags.childElementCount) card.appendChild(tags);
            if (footer.childElementCount) card.appendChild(footer);
            wrapper.appendChild(card);
        });

        return wrapper;
    }

    /**
     * Renderiza botões de ação rápidos contextuais
     * Botões: Abrir Projeto, Ver Tecnologias, Compartilhar, Abrir Código, Voltar, Pesquisar Novamente
     */
    renderActions(actions) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ai-actions';

        actions.forEach((action) => {
            // Oculta botões com ações inválidas
            if (!this.isValidAction(action)) return;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = this.getActionButtonClass(action);
            button.textContent = action.label || 'Abrir';

            // Ícones baseados no tipo de ação
            const icon = this.getActionIcon(action);
            if (icon) {
                button.innerHTML = `${icon} ${action.label || 'Abrir'}`;
            }

            button.addEventListener('click', () => this.onAction(action));
            wrapper.appendChild(button);
        });

        // Se não há ações válidas, não renderiza nada
        if (wrapper.childElementCount === 0) {
            return null;
        }

        return wrapper;
    }

    /**
     * Valida se a ação deve ser exibida
     */
    isValidAction(action) {
        if (!action || !action.type) return false;

        // Ações de navegação precisam de href válido
        if (action.type === 'navigate') {
            return action.href && action.href !== '#';
        }

        // Ações de busca/admin sempre válidas se têm label
        if (['search', 'admin_new_project', 'open_dev_dashboard'].includes(action.type)) {
            return !!action.label;
        }

        return !!action.label;
    }

    /**
     * Retorna classe CSS baseada no tipo de ação
     */
    getActionButtonClass(action) {
        const base = 'ai-action-button';
        const variants = {
            navigate: 'ai-action-button--primary',
            search: 'ai-action-button--secondary',
            admin_new_project: 'ai-action-button--primary',
            open_dev_dashboard: 'ai-action-button--secondary',
            share: 'ai-action-button--ghost',
            copy: 'ai-action-button--ghost'
        };
        return `${base} ${variants[action.type] || 'ai-action-button--secondary'}`;
    }

    /**
     * Retorna ícone SVG/emoji para o tipo de ação
     */
    getActionIcon(action) {
        const icons = {
            navigate: '🔗',
            search: '🔍',
            admin_new_project: '➕',
            open_dev_dashboard: '⚙️',
            share: '📤',
            copy: '📋'
        };
        return icons[action.type] || '';
    }

    renderMatrix() {
        const matrix = document.createElement('div');
        matrix.className = 'ai-matrix';
        matrix.setAttribute('aria-label', 'Animação matrix');

        const rows = [
            '01001010 01010011 00100000 01000001 01001001',
            'ACCESS LOCAL SEARCH PROVIDER',
            'SANITIZE INPUT ... OK',
            'PERMISSION CHECK ... OK',
            'BLOG SECRETO ONLINE'
        ];

        rows.forEach((row) => {
            const line = document.createElement('span');
            line.textContent = row;
            matrix.appendChild(line);
        });

        setTimeout(() => matrix.classList.add('is-fading'), 5000);
        return matrix;
    }

    showTyping(show) {
        this.typingEl.hidden = !show;
        if (show) this.scrollToEnd();
    }

    clear() {
        this.messagesEl.replaceChildren();
    }

    scrollToEnd() {
        requestAnimationFrame(() => {
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        });
    }

    formatTime(value) {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}