/**
 * memory.js - Memória de contexto da conversa
 *
 * Responsabilidades:
 * - Gerenciar histórico de mensagens com metadados enriquecidos
 * - Memória de visitantes (nome, preferências, projetos conhecidos)
 * - Contexto de navegação (página atual, último projeto, buscas recentes)
 * - Resolução de referências contextuais ("ele", "essa lista", "o primeiro")
 * - Exportação/importação de contexto para continuidade entre sessões
 * - Memória de curto prazo (conversa atual) e longo prazo (perfil visitante)
 */

import { SecurityManager } from './SecurityManager.js';
import { StorageManager } from '../services/StorageManager.js';

/**
 * Tipos de entidades referenciáveis no contexto
 */
export const ENTITY_TYPES = Object.freeze({
    PROJECT: 'project',
    POST: 'post',
    TAG: 'tag',
    CATEGORY: 'category',
    FAQ: 'faq',
    SETTING: 'setting',
    SEARCH_RESULT: 'search_result'
});

/**
 * Intentos contextuais que podem referenciar entidades anteriores
 */
export const CONTEXTUAL_INTENTS = Object.freeze([
    'search',
    'list_projects',
    'list_posts',
    'project_technologies',
    'related_content',
    'open_page'
]);

/**
 * MemoryManager - Gerencia memória de conversa e contexto do visitante
 */
export class MemoryManager {
    constructor(options = {}) {
        this.storage = options.storage || new StorageManager('secreto_ai_memory');
        this.security = new SecurityManager();

        // Configurações de memória
        this.config = {
            maxConversationLength: options.maxConversationLength || 80,
            maxContextEntities: options.maxContextEntities || 20,
            entityRetentionMs: options.entityRetentionMs || 24 * 60 * 60 * 1000, // 24h
            visitorProfileRetentionMs: options.visitorProfileRetentionMs || 365 * 24 * 60 * 60 * 1000
        };

        // Estado em memória
        this.conversation = [];
        this.contextEntities = new Map(); // entityId -> { entity, timestamp, accessCount }
        this.currentContext = {
            currentPage: typeof window !== 'undefined' ? window.location.pathname : '/',
            lastProject: null,
            lastPost: null,
            lastSearch: null,
            lastIntent: null,
            lastResults: [],
            lastTopics: [],
            navigationHistory: [typeof window !== 'undefined' ? window.location.pathname : '/'],
            mentionedEntities: [] // Entidades mencionadas na conversa atual
        };

        // Inicializa
        this._loadFromStorage();
        this._cleanupOldEntities();
    }

    // ==================== CONVERSA ====================

    /**
     * Adiciona mensagem à conversa
     */
    addMessage(message) {
        const normalized = this._normalizeMessage(message);
        this.conversation.push(normalized);

        // Mantém tamanho máximo
        if (this.conversation.length > this.config.maxConversationLength) {
            this.conversation = this.conversation.slice(-this.config.maxConversationLength);
        }

        this._saveConversation();
        return normalized;
    }

    /**
     * Obtém histórico de conversa
     */
    getConversation(limit = null) {
        if (limit) {
            return this.conversation.slice(-limit);
        }
        return [...this.conversation];
    }

    /**
     * Obtém últimas mensagens do assistente com resultados
     */
    getRecentAssistantMessages(limit = 3) {
        return this.conversation
            .filter(m => m.role === 'assistant' && m.results?.length > 0)
            .slice(-limit);
    }

    /**
     * Obtém últimas mensagens do usuário
     */
    getRecentUserMessages(limit = 3) {
        return this.conversation
            .filter(m => m.role === 'user')
            .slice(-limit);
    }

    /**
     * Limpa conversa
     */
    clearConversation() {
        this.conversation = [];
        this.currentContext.lastResults = [];
        this.currentContext.lastIntent = null;
        this.currentContext.lastTopics = [];
        this.currentContext.mentionedEntities = [];
        this._saveConversation();
        this._saveContext();
    }

    // ==================== ENTIDADES DE CONTEXTO ====================

    /**
     * Adiciona/atualiza entidade no contexto
     */
    addContextEntity(entity) {
        if (!entity || !entity.id) return;

        const entityId = this._getEntityKey(entity);
        const now = Date.now();

        const existing = this.contextEntities.get(entityId);
        this.contextEntities.set(entityId, {
            entity: this._sanitizeEntity(entity),
            firstSeen: existing?.firstSeen || now,
            lastAccessed: now,
            accessCount: (existing?.accessCount || 0) + 1,
            source: entity.source || 'conversation' // conversation, search, navigation
        });

        // Adiciona às menções da conversa atual
        if (!this.currentContext.mentionedEntities.some(e => this._getEntityKey(e) === entityId)) {
            this.currentContext.mentionedEntities.push(this._sanitizeEntity(entity));
            // Mantém apenas últimas 20 menções
            if (this.currentContext.mentionedEntities.length > 20) {
                this.currentContext.mentionedEntities.shift();
            }
        }

        this._saveContext();
    }

    /**
     * Adiciona múltiplas entidades (ex: resultados de busca)
     */
    addContextEntities(entities, source = 'search') {
        entities.forEach(e => this.addContextEntity({ ...e, source }));
    }

    /**
     * Obtém entidade do contexto por ID
     */
    getContextEntity(entityId) {
        const entry = this.contextEntities.get(entityId);
        if (entry) {
            entry.lastAccessed = Date.now();
            entry.accessCount++;
            return entry.entity;
        }
        return null;
    }

    /**
     * Obtém entidades por tipo
     */
    getContextEntitiesByType(type) {
        const results = [];
        for (const [key, entry] of this.contextEntities) {
            if (entry.entity.type === type) {
                results.push(entry.entity);
            }
        }
        return results;
    }

    /**
     * Obtém entidades mais recentes
     */
    getRecentContextEntities(limit = 10) {
        return [...this.contextEntities.values()]
            .sort((a, b) => b.lastAccessed - a.lastAccessed)
            .slice(0, limit)
            .map(e => e.entity);
    }

    /**
     * Obtém entidades mais acessadas
     */
    getTopContextEntities(limit = 10) {
        return [...this.contextEntities.values()]
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit)
            .map(e => e.entity);
    }

    /**
     * Remove entidade do contexto
     */
    removeContextEntity(entityId) {
        this.contextEntities.delete(entityId);
        this._saveContext();
    }

    /**
     * Limpa entidades antigas
     */
    _cleanupOldEntities() {
        const now = Date.now();
        for (const [key, entry] of this.contextEntities) {
            if (now - entry.lastAccessed > this.config.entityRetentionMs) {
                this.contextEntities.delete(key);
            }
        }
        // Limita total
        if (this.contextEntities.size > this.config.maxContextEntities) {
            const sorted = [...this.contextEntities.entries()]
                .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            const toRemove = sorted.slice(0, sorted.length - this.config.maxContextEntities);
            toRemove.forEach(([key]) => this.contextEntities.delete(key));
        }
    }

    // ==================== CONTEXTO DE NAVEGAÇÃO ====================

    /**
     * Atualiza página atual
     */
    setCurrentPage(page) {
        if (page && page !== this.currentContext.currentPage) {
            const history = this.currentContext.navigationHistory || [];
            if (!history.includes(page)) {
                history.push(page);
                this.currentContext.navigationHistory = history.slice(-10);
            }
            this.currentContext.currentPage = page;
            this._saveContext();
        }
    }

    /**
     * Define último projeto visualizado
     */
    setLastProject(project) {
        this.currentContext.lastProject = project ? this._sanitizeEntity(project) : null;
        if (project) this.addContextEntity({ ...project, type: ENTITY_TYPES.PROJECT, source: 'navigation' });
        this._saveContext();
    }

    /**
     * Define último post visualizado
     */
    setLastPost(post) {
        this.currentContext.lastPost = post ? this._sanitizeEntity(post) : null;
        if (post) this.addContextEntity({ ...post, type: ENTITY_TYPES.POST, source: 'navigation' });
        this._saveContext();
    }

    /**
     * Define última busca
     */
    setLastSearch(query, results = []) {
        this.currentContext.lastSearch = {
            query,
            timestamp: Date.now(),
            resultCount: results.length
        };
        this.currentContext.lastResults = results.slice(0, 12).map(r => this._sanitizeEntity(r));
        this.addContextEntities(results, 'search');
        this._saveContext();
    }

    /**
     * Define último intent
     */
    setLastIntent(intent) {
        this.currentContext.lastIntent = intent;
        this._saveContext();
    }

    /**
     * Obtém contexto completo
     */
    getContext() {
        return { ...this.currentContext };
    }

    /**
     * Obtém resumo do contexto para o provedor de IA
     */
    getContextSummary() {
        const { mentionedEntities, ...rest } = this.currentContext;
        return {
            ...rest,
            recentEntities: this.getRecentContextEntities(5),
            topEntities: this.getTopContextEntities(5),
            conversationLength: this.conversation.length,
            lastUserMessage: this.getRecentUserMessages(1)[0]?.text || null
        };
    }

    // ==================== PERFIL DO VISITANTE ====================

    /**
     * Obtém perfil do visitante
     */
    getVisitorProfile() {
        return this.storage.getVisitorProfile();
    }

    /**
     * Atualiza perfil do visitante
     */
    updateVisitorProfile(updates) {
        return this.storage.updateVisitorProfile(updates);
    }

    /**
     * Define nome do visitante
     */
    setVisitorName(name) {
        const sanitized = this.security.sanitize(name || '').trim();
        if (sanitized) {
            this.updateVisitorProfile({ name: sanitized });
        }
    }

    /**
     * Obtém nome do visitante
     */
    getVisitorName() {
        return this.getVisitorProfile().name || null;
    }

    /**
     * Adiciona projeto conhecido ao perfil
     */
    addKnownProject(project) {
        const profile = this.getVisitorProfile();
        const projects = profile.knownProjects || [];
        const key = project.id || project.nome;

        if (!projects.some(p => (p.id || p.nome) === key)) {
            projects.unshift(this._sanitizeEntity(project));
            this.updateVisitorProfile({ knownProjects: projects.slice(0, 20) });
        }
    }

    /**
     * Adiciona post conhecido
     */
    addKnownPost(post) {
        const profile = this.getVisitorProfile();
        const posts = profile.knownPosts || [];
        const key = post.id || post.titulo;

        if (!posts.some(p => (p.id || p.titulo) === key)) {
            posts.unshift(this._sanitizeEntity(post));
            this.updateVisitorProfile({ knownPosts: posts.slice(0, 20) });
        }
    }

    /**
     * Atualiza preferência de tema
     */
    setThemePreference(theme) {
        this.updateVisitorProfile({ themePreference: theme });
    }

    /**
     * Obtém preferência de tema
     */
    getThemePreference() {
        return this.getVisitorProfile().themePreference || 'system';
    }

    // ==================== RESOLUÇÃO DE REFERÊNCIAS CONTEXTUAIS ====================

    /**
     * Resolve referências contextuais no texto do usuário
     * Ex: "ele", "essa lista", "o primeiro", "aquele projeto"
     */
    resolveContextualReferences(text, intent) {
        const normalized = (text || '').toLowerCase().trim();
        const resolved = {
            entities: [],
            references: [],
            originalText: text
        };

        // Referências posicionais
        if (this._isPositionalReference(normalized)) {
            const entities = this._resolvePositionalReference(normalized);
            resolved.entities.push(...entities);
            resolved.references.push({ type: 'positional', text: normalized, resolved: entities.length });
        }

        // Referências demonstrativas
        if (this._isDemonstrativeReference(normalized)) {
            const entities = this._resolveDemonstrativeReference(normalized, intent);
            resolved.entities.push(...entities);
            resolved.references.push({ type: 'demonstrative', text: normalized, resolved: entities.length });
        }

        // Referências por pronome
        if (this._isPronominalReference(normalized)) {
            const entities = this._resolvePronominalReference(normalized, intent);
            resolved.entities.push(...entities);
            resolved.references.push({ type: 'pronominal', text: normalized, resolved: entities.length });
        }

        // "essa lista", "esses projetos", "aqueles posts"
        if (this._isCollectionReference(normalized)) {
            const entities = this._resolveCollectionReference(normalized, intent);
            resolved.entities.push(...entities);
            resolved.references.push({ type: 'collection', text: normalized, resolved: entities.length });
        }

        // Remove duplicatas
        const uniqueEntities = [];
        const seen = new Set();
        for (const entity of resolved.entities) {
            const key = this._getEntityKey(entity);
            if (!seen.has(key)) {
                seen.add(key);
                uniqueEntities.push(entity);
            }
        }
        resolved.entities = uniqueEntities;

        return resolved;
    }

    /**
     * Verifica se é referência posicional ("o primeiro", "o último", "o segundo")
     */
    _isPositionalReference(text) {
        return /\b(o|a|primeiro|último|segundo|terceiro|quarto|quinto|último?)\b/.test(text);
    }

    /**
     * Resolve referência posicional
     */
    _resolvePositionalReference(text) {
        const results = this.currentContext.lastResults;
        if (!results.length) return [];

        if (/\bprimeiro\b/.test(text)) return [results[0]];
        if (/\b(último|ultimo)\b/.test(text)) return [results[results.length - 1]];
        if (/\bsegundo\b/.test(text)) return results[1] ? [results[1]] : [];
        if (/\bterceiro\b/.test(text)) return results[2] ? [results[2]] : [];
        if (/\bquarto\b/.test(text)) return results[3] ? [results[3]] : [];
        if (/\bquinto\b/.test(text)) return results[4] ? [results[4]] : [];

        return [];
    }

    /**
     * Verifica se é referência demonstrativa ("esse", "essa", "este", "esta", "aquele", "aquela")
     */
    _isDemonstrativeReference(text) {
        return /\b(esse|essa|este|esta|aquele|aquela|isto|isso)\b/.test(text);
    }

    /**
     * Resolve referência demonstrativa baseada em intent
     */
    _resolveDemonstrativeReference(text, intent) {
        const entities = this.currentContext.mentionedEntities;
        if (!entities.length) return [];

        // Se intent é sobre projetos, foca em projetos mencionados
        if (intent === 'list_projects' || intent === 'project_technologies') {
            return entities.filter(e => e.type === ENTITY_TYPES.PROJECT).slice(-3);
        }

        // Se intent é sobre posts
        if (intent === 'list_posts') {
            return entities.filter(e => e.type === ENTITY_TYPES.POST).slice(-3);
        }

        // Retorna as últimas entidades mencionadas
        return entities.slice(-3);
    }

    /**
     * Verifica se é referência pronominal ("ele", "ela", "eles", "elas", "o", "a")
     */
    _isPronominalReference(text) {
        return /\b(ele|ela|eles|elas|o|a)\b/.test(text);
    }

    /**
     * Resolve referência pronominal - usa última entidade relevante
     */
    _resolvePronominalReference(text, intent) {
        const mentioned = this.currentContext.mentionedEntities;
        if (!mentioned.length) return [];

        // Filtra por tipo baseado no intent
        if (intent === 'list_projects' || intent === 'project_technologies') {
            const projects = mentioned.filter(e => e.type === ENTITY_TYPES.PROJECT);
            if (projects.length) return [projects[projects.length - 1]];
        }

        if (intent === 'list_posts') {
            const posts = mentioned.filter(e => e.type === ENTITY_TYPES.POST);
            if (posts.length) return [posts[posts.length - 1]];
        }

        // Último projeto visualizado
        if (this.currentContext.lastProject) {
            return [this.currentContext.lastProject];
        }

        // Último post visualizado
        if (this.currentContext.lastPost) {
            return [this.currentContext.lastPost];
        }

        // Última entidade mencionada
        return [mentioned[mentioned.length - 1]];
    }

    /**
     * Verifica se é referência a coleção ("essa lista", "esses projetos", "aqueles posts")
     */
    _isCollectionReference(text) {
        return /\b(essa|esta|aquela)\s+(lista|lista de|projetos?|posts?|artigos?|resultados?)\b/.test(text) ||
               /\b(esses|estas|aqueles)\s+(projetos?|posts?|artigos?|resultados?)\b/.test(text);
    }

    /**
     * Resolve referência a coleção
     */
    _resolveCollectionReference(text, intent) {
        // "esses projetos" / "essa lista"
        if (/projetos?/.test(text)) {
            return this.currentContext.lastResults.filter(r => r.type === ENTITY_TYPES.PROJECT);
        }
        if (/posts?|artigos?/.test(text)) {
            return this.currentContext.lastResults.filter(r => r.type === ENTITY_TYPES.POST);
        }
        if (/resultados?|lista/.test(text)) {
            return this.currentContext.lastResults;
        }
        return [];
    }

    // ==================== TÓPICOS DA CONVERSA ====================

    /**
     * Extrai tópicos da conversa atual
     */
    extractTopics() {
        const topics = new Set();
        const recentMessages = this.conversation.slice(-10);

        recentMessages.forEach(msg => {
            // Extrai de resultados
            if (msg.results) {
                msg.results.forEach(r => {
                    if (r.tags) r.tags.forEach(t => topics.add(t));
                    if (r.categoria) topics.add(r.categoria);
                    if (r.type === ENTITY_TYPES.PROJECT && r.tecnologias) {
                        r.tecnologias.forEach(t => topics.add(t));
                    }
                });
            }
            // Extrai de ações
            if (msg.actions) {
                msg.actions.forEach(a => {
                    if (a.payload?.query) topics.add(a.payload.query);
                });
            }
        });

        this.currentContext.lastTopics = [...topics].slice(0, 15);
        this._saveContext();
        return this.currentContext.lastTopics;
    }

    /**
     * Obtém tópicos atuais
     */
    getTopics() {
        return [...this.currentContext.lastTopics];
    }

    // ==================== EXPORTAÇÃO/IMPORTAÇÃO ====================

    /**
     * Exporta estado completo da memória
     */
    exportState() {
        return {
            exportedAt: new Date().toISOString(),
            version: '2.0',
            conversation: this.conversation.map(m => this._sanitizeMessageForExport(m)),
            contextEntities: [...this.contextEntities.entries()].map(([k, v]) => [k, {
                entity: v.entity,
                firstSeen: v.firstSeen,
                lastAccessed: v.lastAccessed,
                accessCount: v.accessCount
            }]),
            currentContext: this.currentContext,
            visitorProfile: this.getVisitorProfile()
        };
    }

    /**
     * Importa estado da memória
     */
    importState(state) {
        if (!state || state.version !== '2.0') return false;

        try {
            this.conversation = (state.conversation || []).map(m => this._normalizeMessage(m));
            this.contextEntities = new Map(state.contextEntities || []);
            this.currentContext = { ...this.currentContext, ...state.currentContext };
            if (state.visitorProfile) {
                this.updateVisitorProfile(state.visitorProfile);
            }
            this._saveAll();
            return true;
        } catch (error) {
            console.error('[MemoryManager] Erro ao importar estado:', error);
            return false;
        }
    }

    /**
     * Exporta apenas contexto da conversa (para continuar em outra sessão)
     */
    exportConversationContext() {
        return JSON.stringify({
            exportedAt: new Date().toISOString(),
            messages: this.conversation.slice(-20).map(m => this._sanitizeMessageForExport(m)),
            context: this.getContextSummary(),
            visitor: {
                name: this.getVisitorName(),
                visitCount: this.getVisitorProfile().visitCount
            }
        }, null, 2);
    }

    // ==================== PERSISTÊNCIA ====================

    _loadFromStorage() {
        this.conversation = this.storage.getConversation();
        this.currentContext = this.storage.getConversationContext();
        this._cleanupOldEntities();
    }

    _saveConversation() {
        this.storage.replaceConversation(this.conversation);
    }

    _saveContext() {
        this.storage.updateConversationContext(this.currentContext);
    }

    _saveAll() {
        this._saveConversation();
        this._saveContext();
    }

    // ==================== UTILITÁRIOS ====================

    _normalizeMessage(message) {
        return this.storage.normalizeMessage(message);
    }

    _sanitizeMessageForExport(message) {
        return {
            id: message.id,
            role: message.role,
            text: message.text,
            timestamp: message.timestamp,
            resultsCount: message.results?.length || 0,
            actions: message.actions?.map(a => ({ type: a.type, label: a.label })) || [],
            meta: message.meta
        };
    }

    _sanitizeEntity(entity) {
        return {
            id: entity.id,
            type: entity.type,
            title: entity.title || entity.nome || entity.titulo || 'Sem título',
            description: entity.description || entity.descricao || '',
            href: entity.href || entity.link || '#',
            tags: entity.tags || entity.tecnologias || [],
            categoria: entity.categoria,
            source: entity.source,
            raw: entity // guarda original para casos especiais
        };
    }

    _getEntityKey(entity) {
        return `${entity.type}:${entity.id}`;
    }

    _isValidEntity(entity) {
        return entity && entity.id && entity.type;
    }
}

// Instância singleton
export const memoryManager = new MemoryManager();

// Disponibiliza globalmente para debug
if (typeof window !== 'undefined') {
    window.__MemoryManager = memoryManager;
}