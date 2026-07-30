import { SecurityManager } from './SecurityManager.js';

/**
 * Memória de Conversa Avançada
 * Gerencia contexto do visitante, preferências, histórico e referências contextuais.
 * Preparado para integração futura com IA real.
 */
export class ConversationMemory {
    constructor(storageManager) {
        this.storage = storageManager;
        this.messages = this.storage.getConversation();
        this.visitor = this.storage.getVisitorProfile();
        this.context = this.storage.getConversationContext();
    }

    /**
     * Retorna todas as mensagens armazenadas
     */
    getMessages() {
        return [...this.messages];
    }

    /**
     * Retorna as N mensagens mais recentes
     */
    getRecentMessages(limit = 10) {
        return this.messages.slice(-limit);
    }

    /**
     * Adiciona nova mensagem à memória
     */
    addMessage(role, payload) {
        const message = {
            id: payload.id || SecurityManager.createId(role),
            role,
            text: SecurityManager.sanitize(payload.text || ''),
            timestamp: payload.timestamp || new Date().toISOString(),
            results: Array.isArray(payload.results) ? payload.results : [],
            actions: Array.isArray(payload.actions) ? payload.actions : [],
            meta: payload.meta || {}
        };

        this.messages = this.storage.saveMessage(message);
        return message;
    }

    /**
     * Atualiza perfil do visitante (nome, preferências)
     */
    updateVisitorProfile(updates) {
        this.visitor = this.storage.updateVisitorProfile(updates);
        return this.visitor;
    }

    /**
     * Retorna perfil do visitante
     */
    getVisitorProfile() {
        return { ...this.visitor };
    }

    /**
     * Atualiza contexto da conversa (página atual, último projeto, última pesquisa, etc.)
     */
    updateContext(updates) {
        this.context = this.storage.updateConversationContext(updates);
        return this.context;
    }

    /**
     * Retorna contexto atual da conversa
     */
    getContext() {
        return { ...this.context };
    }

    /**
     * Registra interação com intenção e resultados para referência contextual
     */
    rememberInteraction(intent, results = []) {
        this.context.lastIntent = intent || null;
        this.context.lastResults = Array.isArray(results) ? results.slice(0, 12) : [];
        this.context.lastTopics = this.extractTopics(results);
        this.storage.saveConversationContext(this.context);
    }

    /**
     * Extrai tópicos principais dos resultados
     */
    extractTopics(results) {
        const topics = new Set();
        results.forEach(item => {
            if (item.type === 'project') {
                topics.add('projetos');
                (item.tags || []).forEach(tag => topics.add(tag.toLowerCase()));
            }
            if (item.type === 'post') topics.add('posts');
            if (item.type === 'category') topics.add('categorias');
            if (item.type === 'tag') topics.add('tags');
        });
        return [...topics];
    }

    /**
     * Verifica se a mensagem contém referências contextuais (pronomes, demonstrativos)
     */
    hasContextualReference(text) {
        if (!text) return false;
        const normalized = SecurityManager.normalizeForSearch(text);

        const contextualTerms = [
            'ele', 'ela', 'eles', 'elas',
            'desse', 'dessa', 'destes', 'dessas',
            'deste', 'desta', 'destes', 'destas',
            'esse', 'essa', 'esses', 'essas',
            'aquele', 'aquela', 'aqueles', 'aquelas',
            'qual deles', 'qual delas', 'quais',
            'o primeiro', 'a primeira', 'o segundo', 'a segunda',
            'o ultimo', 'a ultima', 'o último', 'a última',
            'essa lista', 'essa pesquisa', 'esses resultados',
            'esses projetos', 'esses posts', 'aqueles projetos',
            'sobre ele', 'sobre ela', 'mais sobre', 'detalhes',
            'tecnologias', 'tecnologia usa', 'usa o que'
        ];

        return contextualTerms.some(term => normalized.includes(term));
    }

    /**
     * Resolve itens referenciais baseado no contexto anterior
     */
    resolveContextualItems(text) {
        if (!this.hasContextualReference(text)) return [];

        const normalized = SecurityManager.normalizeForSearch(text);
        const lastResults = this.context.lastResults || [];

        // Referência ao primeiro item
        if (['o primeiro', 'a primeira', 'o primeiro da lista', 'primeiro resultado'].some(t => normalized.includes(t))) {
            return lastResults.slice(0, 1);
        }

        // Referência ao último item
        if (['o ultimo', 'a ultima', 'o último', 'a última', 'ultimo resultado', 'último da lista'].some(t => normalized.includes(t))) {
            return lastResults.slice(-1);
        }

        // Referência a "ele/ela" - assume o primeiro resultado mais relevante
        if (['ele', 'ela', 'sobre ele', 'sobre ela'].some(t => normalized.includes(t))) {
            return lastResults.slice(0, 1);
        }

        // Referência a "eles/elas" - todos os resultados
        if (['eles', 'elas', 'esses', 'essas', 'aqueles', 'aquelas'].some(t => normalized.includes(t))) {
            return lastResults;
        }

        // Referência a projetos especificamente
        if (['esses projetos', 'aqueles projetos', 'projetos da lista'].some(t => normalized.includes(t))) {
            return lastResults.filter(r => r.type === 'project');
        }

        // Referência a posts especificamente
        if (['esses posts', 'aqueles posts', 'posts da lista'].some(t => normalized.includes(t))) {
            return lastResults.filter(r => r.type === 'post');
        }

        // Referência a tecnologias
        if (['tecnologias', 'tecnologia', 'linguagens', 'stack', 'usa o que'].some(t => normalized.includes(t))) {
            const project = lastResults.find(r => r.type === 'project');
            return project ? [project] : [];
        }

        // Default: retorna últimos resultados
        return lastResults.slice(0, 3);
    }

    /**
     * Gera resumo dos últimos resultados para inclusão na resposta
     */
    summarizeLastResults(limit = 4) {
        if (!this.context.lastResults?.length) return '';

        return this.context.lastResults
            .slice(0, limit)
            .map(item => item.title || item.nome || item.name)
            .filter(Boolean)
            .join(', ');
    }

    /**
     * Retorna contexto completo para o provedor de IA
     */
    getFullContext() {
        return {
            recentMessages: this.getRecentMessages(8),
            visitorProfile: this.getVisitorProfile(),
            conversationContext: this.getContext(),
            hasContextualReference: (text) => this.hasContextualReference(text),
            resolveContextualItems: (text) => this.resolveContextualItems(text),
            summarizeLastResults: (limit) => this.summarizeLastResults(limit),
            contextualTopics: this.context.lastTopics || []
        };
    }

    /**
     * Inicia nova conversa (limpa mensagens mas mantém perfil do visitante)
     */
    newConversation() {
        this.storage.startNewConversation();
        this.messages = [];
        this.context = this.storage.getConversationContext();
    }

    /**
     * Limpa tudo (incluindo perfil do visitante)
     */
    clearAll() {
        this.storage.clearAll();
        this.messages = [];
        this.visitor = this.storage.getVisitorProfile();
        this.context = this.storage.getConversationContext();
    }

    /**
     * Exporta dados da conversa
     */
    exportConversation() {
        return JSON.stringify({
            exportedAt: new Date().toISOString(),
            visitor: this.visitor,
            context: this.context,
            messages: this.messages
        }, null, 2);
    }
}