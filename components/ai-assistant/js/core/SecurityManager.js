export class SecurityManager {
    static get MAX_MESSAGE_LENGTH() {
        return 800;
    }

    static get RATE_LIMIT_WINDOW_MS() {
        return 10000;
    }

    static get RATE_LIMIT_MAX() {
        return 6;
    }

    static sanitize(input) {
        if (typeof input !== 'string') return '';

        return input
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
            .replace(/\s(?:javascript|vbscript):/gi, '')
            .trim()
            .slice(0, this.MAX_MESSAGE_LENGTH);
    }

    static escapeHTML(input) {
        if (input === null || input === undefined) return '';

        return String(input)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static normalizeForSearch(input) {
        return String(input || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    static validateMessage(input) {
        const text = this.sanitize(input);

        if (!text) {
            throw new Error('Digite uma mensagem antes de enviar.');
        }

        if (String(input || '').length > this.MAX_MESSAGE_LENGTH) {
            throw new Error(`A mensagem deve ter no máximo ${this.MAX_MESSAGE_LENGTH} caracteres.`);
        }

        if (/(.)\1{80,}/.test(text)) {
            throw new Error('Mensagem bloqueada por parecer spam.');
        }

        return text;
    }

    static validateRateLimit(storageManager) {
        const lastMessages = storageManager.getRecentTimestamps(
            this.RATE_LIMIT_MAX,
            this.RATE_LIMIT_WINDOW_MS
        );

        if (lastMessages.length >= this.RATE_LIMIT_MAX) {
            const timeDiff = Date.now() - lastMessages[0];
            if (timeDiff < this.RATE_LIMIT_WINDOW_MS) {
                throw new Error('Muitas mensagens em pouco tempo. Aguarde alguns segundos.');
            }
        }
    }

    static safeJsonParse(value, fallback) {
        try {
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    static createId(prefix = 'msg') {
        const random = Math.random().toString(36).slice(2, 8);
        return `${prefix}-${Date.now().toString(36)}-${random}`;
    }

    static safeUrl(url) {
        if (!url || typeof url !== 'string') return '#';

        const trimmed = url.trim();
        if (!trimmed || trimmed === '#') return '#';

        if (/^(javascript|vbscript|data):/i.test(trimmed)) {
            return '#';
        }

        if (trimmed.startsWith('//')) {
            return '#';
        }

        if (
            trimmed.startsWith('./') ||
            trimmed.startsWith('../') ||
            trimmed.startsWith('/') ||
            trimmed.startsWith('#') ||
            /^[a-z0-9/_-]+\.html(?:[?#].*)?$/i.test(trimmed)
        ) {
            return trimmed;
        }

        try {
            const parsed = new URL(trimmed, window.location.href);
            const allowedProtocols = ['http:', 'https:', 'mailto:'];
            return allowedProtocols.includes(parsed.protocol) ? parsed.href : '#';
        } catch (error) {
            return '#';
        }
    }

    static isAdminOnlyTopic(input) {
        const text = this.normalizeForSearch(input);
        const internalTerms = [
            'api privada',
            'token',
            'chave',
            'senha',
            'logs',
            'log',
            'banco de dados',
            'usuarios',
            'servidor',
            'memoria',
            'cpu',
            'sessao',
            'github',
            'estatistica administrativa',
            'seguranca interna'
        ];

        return internalTerms.some((term) => text.includes(term));
    }

    static redactPublicText(text) {
        if (!text) return '';

        return String(text)
            .replace(/(api[_-]?key|token|secret|password|senha)\s*[:=]\s*[\w.-]+/gi, '$1: [restrito]')
            .replace(/Bearer\s+[\w.-]+/gi, 'Bearer [restrito]');
    }
}
