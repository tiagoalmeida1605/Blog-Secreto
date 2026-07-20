export class AIProvider {
    constructor(config = {}) {
        this.config = config;
        this.id = config.id || 'base';
        this.label = config.label || 'AIProvider';
    }

    async generate() {
        throw new Error('AIProvider.generate precisa ser implementado pelo provedor concreto.');
    }

    normalizeResponse(response) {
        if (typeof response === 'string') {
            return { text: response, results: [], actions: [], meta: {} };
        }

        return {
            text: response.text || '',
            results: Array.isArray(response.results) ? response.results : [],
            actions: Array.isArray(response.actions) ? response.actions : [],
            suggestions: Array.isArray(response.suggestions) ? response.suggestions : [],
            meta: response.meta || {}
        };
    }
}

export class RemoteAIProvider extends AIProvider {
    constructor(config = {}) {
        super(config);
        this.endpoint = config.endpoint || '';
        this.apiKey = config.apiKey || '';
        this.model = config.model || '';
    }

    isConfigured() {
        return Boolean(this.endpoint && (this.apiKey || this.config.allowAnonymous));
    }

    async generate() {
        return this.normalizeResponse({
            text: `${this.label} ainda não está configurado. A arquitetura já aceita este provedor; configure endpoint, modelo e credenciais no backend para ativar.`,
            meta: { provider: this.id, configured: false }
        });
    }
}

export class OpenAIProvider extends RemoteAIProvider {
    constructor(config = {}) {
        super({ id: 'openai', label: 'OpenAI', ...config });
    }
}

export class GeminiProvider extends RemoteAIProvider {
    constructor(config = {}) {
        super({ id: 'gemini', label: 'Gemini', ...config });
    }
}

export class ClaudeProvider extends RemoteAIProvider {
    constructor(config = {}) {
        super({ id: 'claude', label: 'Claude', ...config });
    }
}

export class OllamaProvider extends RemoteAIProvider {
    constructor(config = {}) {
        super({ id: 'ollama', label: 'Ollama', allowAnonymous: true, ...config });
    }
}

export class LMStudioProvider extends RemoteAIProvider {
    constructor(config = {}) {
        super({ id: 'lmstudio', label: 'LM Studio', allowAnonymous: true, ...config });
    }
}

export class ProviderRegistry {
    constructor() {
        this.providers = new Map();
    }

    register(name, factory) {
        this.providers.set(name, factory);
    }

    create(name, dependencies = {}) {
        const factory = this.providers.get(name);
        if (!factory) {
            throw new Error(`Provedor não registrado: ${name}`);
        }

        return factory(dependencies);
    }

    list() {
        return [...this.providers.keys()];
    }
}
