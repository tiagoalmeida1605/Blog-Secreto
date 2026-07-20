import { SecurityManager } from '../core/SecurityManager.js';

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
            copyButton.title = 'Copiar resposta';
            copyButton.setAttribute('aria-label', 'Copiar resposta do assistente');
            copyButton.addEventListener('click', () => this.onCopy(message.text));
            meta.append(copyButton);
        }

        const content = document.createElement('div');
        content.className = 'ai-message__content';
        this.renderText(content, message.text);

        bubble.append(meta, content);

        if (Array.isArray(message.results) && message.results.length) {
            bubble.append(this.renderResults(message.results));
        }

        if (Array.isArray(message.actions) && message.actions.length) {
            bubble.append(this.renderActions(message.actions));
        }

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

    renderText(container, text) {
        const lines = String(text || '').split('\n');
        let currentList = null;

        lines.forEach((line) => {
            const trimmed = line.trim();

            if (!trimmed) {
                currentList = null;
                return;
            }

            if (trimmed.startsWith('- ')) {
                if (!currentList) {
                    currentList = document.createElement('ul');
                    container.appendChild(currentList);
                }

                const item = document.createElement('li');
                item.textContent = trimmed.slice(2);
                currentList.appendChild(item);
                return;
            }

            currentList = null;
            const paragraph = document.createElement('p');
            paragraph.textContent = trimmed;
            container.appendChild(paragraph);
        });
    }

    renderResults(results) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ai-results';

        results.slice(0, 6).forEach((result) => {
            const card = document.createElement('article');
            card.className = 'ai-result-card';

            const label = document.createElement('span');
            label.className = 'ai-result-card__type';
            label.textContent = result.typeLabel || result.type || 'Conteúdo';

            const title = document.createElement('h4');
            title.textContent = result.title || 'Sem título';

            const description = document.createElement('p');
            description.textContent = result.description || 'Sem descrição cadastrada.';

            const tags = document.createElement('div');
            tags.className = 'ai-result-card__tags';
            (result.tags || []).slice(0, 5).forEach((tag) => {
                const chip = document.createElement('span');
                chip.textContent = tag;
                tags.appendChild(chip);
            });

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

            card.append(label, title, description);
            if (tags.childElementCount) card.appendChild(tags);
            if (footer.childElementCount) card.appendChild(footer);
            wrapper.appendChild(card);
        });

        return wrapper;
    }

    renderActions(actions) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ai-actions';

        actions.forEach((action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ai-action-button';
            button.textContent = action.label || 'Abrir';
            button.addEventListener('click', () => this.onAction(action));
            wrapper.appendChild(button);
        });

        return wrapper;
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
