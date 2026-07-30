/**
 * assistant.js - Orquestrador principal do Assistente IA
 *
 * Responsabilidades:
 * - Inicializar e coordenar todos os módulos
 * - Processar entrada do usuário (pipeline completo)
 * - Gerenciar ciclo de vida da conversa
 * - Interface pública para integração com UI
 * - Tratamento de erros e fallbacks
 * - Modo debug e métricas
 */

import { SecurityManager } from './core/SecurityManager.js';
import { IntentRecognizer } from './core/IntentRecognizer.js';
import { MemoryManager, ENTITY_TYPES, CONTEXTUAL_INTENTS } from './core/memory.js';
import { KnowledgeBase } from './core/knowledge.js';
import { SearchEngine, SEARCH_TYPES } from './core/search.js';
import { ResponseGenerator } from './core/responses.js';
import { ActionManager, ACTION_TYPES, ACTION_VARIANTS } from './core/actions.js';
import { firebaseService, COLLECTIONS, SERVICE_EVENTS, CONNECTION_STATE } from '../services/firebaseService.js';
import { TypingIndicator } from '../ui/TypingIndicator.js';

/**
 * Configuração padrão do assistente
 */
const DEFAULT_CONFIG = {
    // Módulos
    enableFirebase: true,
    enableLocalSearch: true,
    enableMemory: true,
    enableTypingIndicator: true,

    // Comportamento
    maxResponseTime: 5000,
    typingDelay: 300,
    maxSuggestions: 5,

    // Personalidade
    personality: 'balanced', // friendly, technical, concise, playful, balanced

    // Debug
    debug: false,
    logLevel: 'info' // debug, info, warn, error

};

/**
 * Estados do assistente
 */
export const ASSISTANT_STATE = Object.freeze({
    INITIALIZING: 'initializing',
    READY: 'ready',
    PROCESSING: 'processing',
    ERROR: 'error',
    OFFLINE: 'offline'
});

/**
 * Eventos públicos do assistente
 */
export const ASSISTANT_EVENTS = Object.freeze({
    MESSAGE_RECEIVED: 'message:received',
    MESSAGE_SENT: 'message:sent',
    RESPONSE_START: 'response:start',
    RESPONSE_COMPLETE: 'response:complete',
    RESPONSE_ERROR: 'response:error',
    STATE_CHANGED: 'state:changed',
    CONTEXT_UPDATED: 'context:updated',
    SEARCH_PERFORMED: 'search:performed',
    ACTION_EXECUTED: 'action:executed',
    CONNECTION_CHANGED: 'connection:changed'
});

/**
 * Assistant - Orquestrador principal
 */
export class Assistant {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.security = new SecurityManager();
        this.state = ASSISTANT_STATE.INITIALIZING;
        this.eventListeners = new Map();

        // Módulos (inicializados lazy)
        this._modules = {};
        this._initialized = false;
        this._initPromise = null;

        // Métricas
        this.metrics = {
            messagesProcessed: 0,
            searchesPerformed: 0,
            actionsExecuted: 0,
            errors: 0,
            avgResponseTime: 0,
            cacheHitRate: 0
        };

        // Bind context
        this._boundHandleOnline = this._handleOnline.bind(this);
        this._boundHandleOffline = this._handleOffline.bind(this);

        // Inicializa automaticamente
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    // ==================== INICIALIZAÇÃO ====================

    /**
     * Inicializa o assistente e todos os módulos
     */
    async init() {
        if (this._initialized) return this;
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._doInit();
        return this._initPromise;
    }

    async _doInit() {
        const startTime = Date.now();
        this._log('info', 'Iniciando Assistente IA...');

        try {
            this._setState(ASSISTANT_STATE.INITIALIZING);

            // Inicializa módulos base
            await this._initModules();

            // Configura listeners globais
            this._setupGlobalListeners();

            // Aguarda Firebase se habilitado
            if (this.config.enableFirebase) {
                await this._waitForFirebase();
            }

            // Carrega contexto salvo
            this._loadPersistedContext();

            this._initialized = true;
            this._setState(ASSISTANT_STATE.READY);

            const initTime = Date.now() - startTime;
            this._log('info', `Assistente pronto em ${initTime}ms`);

            // Emite evento de pronto
            this._emit(ASSISTANT_EVENTS.STATE_CHANGED, {
                state: ASSISTANT_STATE.READY,
                initTime
            });

            return this;
        } catch (error) {
            this._log('error', 'Falha na inicialização:', error);
            this._setState(ASSISTANT_STATE.ERROR);
            throw error;
        }
    }

    /**
     * Inicializa módulos principais
     */
    async _initModules() {
        // Intent Recognizer (sem dependências)
        this._modules.intent = new IntentRecognizer();

        // Memory Manager
        this._modules.memory = new MemoryManager({
            security: this.security
        });

        // Firebase Service
        if (this.config.enableFirebase) {
            this._modules.firebase = firebaseService;
            await firebaseService.init();
        }

        // Knowledge Base
        this._modules.knowledge = new KnowledgeBase({
            firebaseService: this._modules.firebase
        });
        await this._modules.knowledge.init();

        // Search Engine
        this._modules.search = new SearchEngine({
            knowledge: this._modules.knowledge,
            firebase: this._modules.firebase
        });
        await this._modules.search.init();

        // Response Generator
        this._modules.responses = new ResponseGenerator({
            personality: this.config.personality,
            security: this.security
        });

        // Action Manager
        this._modules.actions = new ActionManager({
            security: this.security
        });

        // Typing Indicator
        if (this.config.enableTypingIndicator) {
            this._modules.typing = new TypingIndicator({
                steps: [
                    { text: 'Pensando', duration: 400, dots: true },
                    { text: 'Buscando', duration: 300, dots: true },
                    { text: 'Organizando', duration: 300, dots: true },
                    { text: 'Respondendo', duration: 200, dots: false }
                ]
            });
        }

        this._log('debug', 'Módulos inicializados:', Object.keys(this._modules));
    }

    /**
     * Aguarda Firebase ficar pronto
     */
    async _waitForFirebase(timeout = 10000) {
        if (!this._modules.firebase) return;

        return new Promise((resolve) => {
            const state = this._modules.firebase.getConnectionState();
            if (state === CONNECTION_STATE.CONNECTED) {
                resolve();
                return;
            }

            const unsubscribe = this._modules.firebase.on(SERVICE_EVENTS.CONNECTION_CHANGED, (newState) => {
                if (newState === CONNECTION_STATE.CONNECTED) {
                    unsubscribe();
                    resolve();
                }
            });

            // Timeout
            setTimeout(() => {
                unsubscribe();
                this._log('warn', 'Timeout aguardando Firebase, continuando offline');
                resolve();
            }, timeout);
        });
    }

    /**
     * Configura listeners globais
     */
    _setupGlobalListeners() {
        window.addEventListener('online', this._boundHandleOnline);
        window.addEventListener('offline', this._boundHandleOffline);

        // Listener de conexão do Firebase
        if (this._modules.firebase) {
            this._modules.firebase.on(SERVICE_EVENTS.CONNECTION_CHANGED, (state) => {
                this._emit(ASSISTANT_EVENTS.CONNECTION_CHANGED, { state });
                if (state === CONNECTION_STATE.DISCONNECTED) {
                    this._setState(ASSISTANT_STATE.OFFLINE);
                } else if (state === CONNECTION_STATE.CONNECTED && this.state === ASSISTANT_STATE.OFFLINE) {
                    this._setState(ASSISTANT_STATE.READY);
                }
            });
        }
    }

    /**
     * Carrega contexto persistido
     */
    _loadPersistedContext() {
        try {
            const context = this._modules.memory.getContext();
            this._log('debug', 'Contexto carregado:', context);
        } catch (error) {
            this._log('warn', 'Erro ao carregar contexto:', error);
        }
    }

    // ==================== PROCESSAMENTO DE MENSAGENS ====================

    /**
     * Processa mensagem do usuário (pipeline completo)
     * @param {string} input - Texto do usuário
     * @param {Object} options - Opções de processamento
     * @returns {Promise<Object>} Resposta estruturada
     */
    async processMessage(input, options = {}) {
        const {
            skipTyping = false,
            skipMemory = false,
            context = {},
            stream = false
        } = options;

        if (!input || !input.trim()) {
            return this._createResponse('empty', 'Mensagem vazia');
        }

        if (this.state === ASSISTANT_STATE.PROCESSING) {
            return this._createResponse('busy', 'Aguarde, estou processando outra mensagem');
        }

        const startTime = Date.now();
        this._setState(ASSISTANT_STATE.PROCESSING);

        try {
            // Sanitiza entrada
            const sanitizedInput = this.security.sanitize(input.trim());
            const messageId = this.security.createId('msg');

            // Emite evento de recebimento
            this._emit(ASSISTANT_EVENTS.MESSAGE_RECEIVED, {
                messageId,
                input: sanitizedInput,
                timestamp: Date.now()
            });

            // Mostra indicador de digitação
            if (!skipTyping && this._modules.typing) {
                this._modules.typing.start();
            }

            // 1. Reconhece intent
            const memoryContext = skipMemory ? {} : this._modules.memory.getContextSummary();
            const intentRecognition = this._modules.intent.recognize(sanitizedInput, {
                memory: this._modules.memory.getContext()
            });

            this._log('debug', 'Intent reconhecido:', intentRecognition);

            // 2. Resolve referências contextuais
            let resolvedEntities = [];
            if (CONTEXTUAL_INTENTS.includes(intentRecognition.name)) {
                const resolution = this._modules.memory.resolveContextualReferences(
                    sanitizedInput,
                    intentRecognition.name
                );
                resolvedEntities = resolution.entities;
                this._log('debug', 'Entidades resolvidas:', resolvedEntities);
            }

            // 3. Executa busca/ação baseada no intent
            const searchResult = await this._executeIntent(
                intentRecognition,
                sanitizedInput,
                resolvedEntities,
                context
            );

            // 4. Atualiza memórias
            if (!skipMemory) {
                this._updateMemory(
                    sanitizedInput,
                    intentRecognition,
                    searchResult,
                    resolvedEntities
                );
            }

            // 5. Gera resposta natural
            const responseText = this._generateResponse(
                intentRecognition,
                searchResult,
                context
            );

            // 6. Gera ações contextuais
            const actions = this._generateActions(
                intentRecognition,
                searchResult,
                context
            );

            // Para typing indicator
            if (!skipTyping && this._modules.typing) {
                this._modules.typing.stop();
            }

            const responseTime = Date.now() - startTime;
            this._updateMetrics(responseTime, true);

            // Prepara resposta final
            const response = {
                id: messageId,
                role: 'assistant',
                text: responseText,
                timestamp: new Date().toISOString(),
                intent: intentRecognition.name,
                confidence: intentRecognition.confidence,
                entities: intentRecognition.entities,
                resolvedEntities,
                results: searchResult.results || [],
                actions,
                meta: {
                    responseTime,
                    fromCache: searchResult.fromCache || false,
                    source: searchResult.source || 'search'
                }
            };

            // Salva na conversa
            this._modules.memory.addMessage(response);

            // Emite evento de resposta completa
            this._emit(ASSISTANT_EVENTS.RESPONSE_COMPLETE, { response });

            this._setState(ASSISTANT_STATE.READY);
            return response;

        } catch (error) {
            this._log('error', 'Erro ao processar mensagem:', error);

            if (this._modules.typing) {
                this._modules.typing.stop();
            }

            this._updateMetrics(Date.now() - startTime, false);
            this._setState(ASSISTANT_STATE.ERROR);

            this._emit(ASSISTANT_EVENTS.RESPONSE_ERROR, { error: error.message });

            // Resposta de erro amigável
            const errorResponse = this._createErrorResponse(error);
            return errorResponse;
        }
    }

    /**
     * Executa intent reconhecido
     */
    async _executeIntent(intent, input, resolvedEntities, context) {
        const { name, entities } = intent;
        const memory = this._modules.memory;

        this._emit(ASSISTANT_EVENTS.SEARCH_PERFORMED, { intent: name, query: input });

        // Mescla entidades do intent com resolvidas
        const allEntities = {
            ...entities,
            ...Object.fromEntries(resolvedEntities.map(e => [e.type, e]))
        };

        // Navegação
        if (name === 'open_page') {
            const target = entities.target || 'home';
            const success = await this._navigateTo(target);
            return { results: [], source: 'navigation', success, target };
        }

        // Ações admin
        if (name === 'admin_action' || name === 'developer_dashboard') {
            return this._handleAdminAction(name, entities, context);
        }

        // Buscas
        let searchType = SEARCH_TYPES.ALL;

        switch (name) {
            case 'list_projects':
                searchType = SEARCH_TYPES.PROJECTS;
                break;
            case 'list_posts':
                searchType = SEARCH_TYPES.POSTS;
                break;
            case 'list_tags':
                searchType = SEARCH_TYPES.TAGS;
                break;
            case 'list_categories':
                searchType = SEARCH_TYPES.CATEGORIES;
                break;
            case 'gallery':
                searchType = SEARCH_TYPES.GALLERY;
                break;
            case 'changelog':
                // Busca especial
                const changelog = await this._modules.knowledge.getChangelog({ limit: 20 });
                return { results: changelog, source: 'changelog' };
            case 'faq':
                const faq = await this._modules.knowledge.getFAQ();
                return { results: faq, source: 'faq' };
            case 'help':
            case 'about':
            case 'greeting':
            case 'goodbye':
            case 'thanks':
            case 'system_status':
                // Não precisa de busca
                return { results: [], source: 'builtin', intent: name };
        }

        // Busca com contexto de entidades resolvidas
        const filters = this._buildFilters(allEntities, context);

        const searchResult = await this._modules.search.search(input, {
            type: searchType,
            filters,
            limit: 12,
            trackHistory: true
        });

        // Adiciona entidades resolvidas aos resultados
        if (resolvedEntities.length > 0) {
            searchResult.results = [
                ...resolvedEntities.map(e => ({
                    ...e,
                    _resolved: true,
                    score: 1000 // Prioridade máxima
                })),
                ...searchResult.results
            ];
        }

        return searchResult;
    }

    /**
     * Constrói filtros baseados em entidades
     */
    _buildFilters(entities, context) {
        const filters = {};

        if (entities.technology) {
            filters.technology = entities.technology;
        }
        if (entities.status) {
            filters.status = entities.status;
        }
        if (entities.category) {
            filters.category = entities.category;
        }
        if (entities.projectId) {
            filters.projectId = entities.projectId;
        }

        // Contexto de navegação
        if (context.recentDays) {
            filters.recentDays = context.recentDays;
        }

        return filters;
    }

    /**
     * Navega para página
     */
    async _navigateTo(target) {
        const routes = {
            home: '/',
            projetos: '/projetos.html',
            projetos: '/projetos.html',
            galeria: '/galeria.html',
            contato: '/contato.html',
            dashboard: '/admin/dashboard.html',
            admin: '/admin/dashboard.html'
        };

        const url = routes[target] || routes.home;

        // Tenta usar router SPA se disponível
        if (window.router && typeof window.router.navigate === 'function') {
            window.router.navigate(url);
            return true;
        }

        // Fallback para navegação normal
        window.location.href = url;
        return true;
    }

    /**
     * Trata ações admin
     */
    async _handleAdminAction(intent, entities, context) {
        const action = entities.action || entities.command;
        const isAdmin = this.security.isAdmin();

        if (!isAdmin && intent !== 'developer_dashboard') {
            return {
                results: [],
                source: 'admin',
                error: 'permission_denied',
                message: 'Acesso restrito a administradores'
            };
        }

        // Dispatch para UI admin
        if (window.dispatchAdminAction) {
            window.dispatchAdminAction({ action, ...entities });
        }

        return { results: [], source: 'admin', action, success: true };
    }

    /**
     * Gera resposta natural
     */
    _generateResponse(intent, searchResult, context) {
        const memory = this._modules.memory;
        const visitorName = memory.getVisitorName();
        const conversationLength = memory.conversation.length;

        const responseContext = {
            visitorName,
            lastIntent: memory.currentContext.lastIntent,
            isAdmin: this.security.isAdmin(),
            conversationLength,
            currentPage: memory.currentContext.currentPage
        };

        // Intents que não precisam de busca
        if (['help', 'about', 'greeting', 'goodbye', 'thanks', 'system_status'].includes(intent.name)) {
            return this._modules.responses.generate(intent.name, {}, responseContext);
        }

        // Intents com resultados de busca
        const data = this._prepareResponseData(intent.name, searchResult, context);
        return this._modules.responses.generate(intent.name, data, responseContext);
    }

    /**
     * Prepara dados para gerador de resposta
     */
    _prepareResponseData(intentName, searchResult, context) {
        const { results = [], fromCache, total, filters } = searchResult;

        switch (intentName) {
            case 'list_projects':
                return {
                    projects: results.filter(r => r.type === 'project' || r.source === 'projects'),
                    filterDescription: this._buildFilterDescription(filters),
                    total
                };

            case 'project_details':
            case 'project_technologies':
                const project = results.find(r => r.type === 'project' || r._resolved);
                return {
                    project,
                    technologies: project?.tecnologias || project?.tags || []
                };

            case 'list_posts':
                return {
                    posts: results.filter(r => r.type === 'post' || r.source === 'posts'),
                    filterDescription: this._buildFilterDescription(filters),
                    total
                };

            case 'list_tags':
                return { tags: results.filter(r => r.type === 'tag') };

            case 'list_categories':
                return { categories: results.filter(r => r.type === 'category') };

            case 'gallery':
                return {
                    images: results.filter(r => r.type === 'gallery'),
                    filterDescription: this._buildFilterDescription(filters),
                    total
                };

            case 'faq':
                return { faq: results.filter(r => r.type === 'faq') };

            case 'search':
                return {
                    query: context.originalQuery || '',
                    results,
                    total,
                    fromCache
                };

            default:
                return { results, total };
        }
    }

    /**
     * Constrói descrição de filtros para resposta
     */
    _buildFilterDescription(filters) {
        if (!filters || Object.keys(filters).length === 0) return '';

        const parts = [];
        if (filters.technology) parts.push(`tecnologia "${filters.technology}"`);
        if (filters.category) parts.push(`categoria "${filters.category}"`);
        if (filters.status) parts.push(`status "${filters.status}"`);
        if (filters.recentDays) parts.push(`últimos ${filters.recentDays} dias`);

        return parts.length ? ` (filtrados por ${parts.join(', ')})` : '';
    }

    /**
     * Gera ações contextuais
     */
    _generateActions(intent, searchResult, context) {
        const { results = [] } = searchResult;
        const memory = this._modules.memory;
        const isAdmin = this.security.isAdmin();

        const actions = [];

        // Ações baseadas no intent
        switch (intent.name) {
            case 'list_projects':
                if (results.length) {
                    // Usa generateSearchActions para suggestions relacionadas ou cria ação genérica
                    actions.push(...this._modules.actions.generateSearchActions(results, 'projetos'));
                }
                actions.push(this._modules.actions.createAction({
                    type: ACTION_TYPES.SEARCH,
                    label: '🔍 Buscar outros projetos',
                    variant: ACTION_VARIANTS.GHOST,
                    payload: { query: 'projetos' }
                }));
                break;

            case 'project_details':
            case 'project_technologies':
                const project = results.find(r => r.type === 'project');
                if (project) {
                    actions.push(this._modules.actions.createAction({
                        type: ACTION_TYPES.NAVIGATE,
                        label: '🔗 Abrir Projeto',
                        href: project.href || project.link,
                        variant: ACTION_VARIANTS.PRIMARY,
                        payload: { projectId: project.id }
                    }));

                    if (project.tecnologias?.length || project.tags?.length) {
                        actions.push(this._modules.actions.createAction({
                            type: ACTION_TYPES.SEARCH,
                            label: '🛠️ Ver Tecnologias',
                            variant: ACTION_VARIANTS.SECONDARY,
                            payload: { query: `tecnologias do ${project.title || project.nome}` }
                        }));
                    }

                    actions.push(this._modules.actions.createAction({
                        type: ACTION_TYPES.RELATED,
                        label: '🔄 Projetos Relacionados',
                        variant: ACTION_VARIANTS.SECONDARY,
                        payload: { query: `projetos similares a ${project.title || project.nome}` }
                    }));
                }
                break;

            case 'list_posts':
                if (results.length) {
                    actions.push(this._modules.actions.createAction({
                        type: ACTION_TYPES.NAVIGATE,
                        label: '📖 Ler Post',
                        href: results[0].href,
                        variant: ACTION_VARIANTS.PRIMARY,
                        payload: { postId: results[0].id }
                    }));
                }
                actions.push(this._modules.actions.createAction({
                    type: ACTION_TYPES.SEARCH,
                    label: '📝 Mais Posts',
                    variant: ACTION_VARIANTS.GHOST,
                    payload: { query: 'posts' }
                }));
                break;

            case 'search':
                if (results.length) {
                    actions.push(...this._modules.actions.generateSearchActions(results, intent.entities.query));
                }
                break;

            case 'admin_action':
            case 'developer_dashboard':
                if (isAdmin) {
                    actions.push(...this._modules.actions.generateAdminActions({ isAdmin: true }));
                }
                break;
        }

        // Ações genéricas de follow-up
        if (actions.length < 6) {
            actions.push(this._modules.actions.createAction({
                type: ACTION_TYPES.SEARCH,
                label: '💡 Sugerir algo',
                variant: ACTION_VARIANTS.GHOST,
                payload: { query: 'ajuda' }
            }));
        }

        return actions.slice(0, 6);
    }

    /**
     * Atualiza memórias após processamento
     */
    _updateMemory(input, intent, searchResult, resolvedEntities) {
        const memory = this._modules.memory;

        // Salva contexto de navegação se relevante
        if (intent.name === 'list_projects') {
            memory.setLastSearch(input, searchResult.results);
            memory.currentContext.lastIntent = intent.name;
        } else if (intent.name === 'project_details' || intent.name === 'project_technologies') {
            const project = searchResult.results.find(r => r.type === 'project');
            if (project) {
                memory.setLastProject(project);
                memory.addKnownProject(project);
            }
        } else if (intent.name === 'list_posts') {
            memory.setLastSearch(input, searchResult.results);
            memory.currentContext.lastIntent = intent.name;
        }

        // Adiciona entidades resolvidas ao contexto
        resolvedEntities.forEach(e => memory.addContextEntity(e));

        // Adiciona resultados ao contexto
        searchResult.results.forEach(r => {
            if (r.type === 'project') memory.addContextEntity({ ...r, type: ENTITY_TYPES.PROJECT });
            if (r.type === 'post') memory.addContextEntity({ ...r, type: ENTITY_TYPES.POST });
        });

        // Atualiza tópicos
        memory.extractTopics();
    }

    // ==================== RESPOSTAS DE ERRO ====================

    _createResponse(type, text) {
        return {
            id: this.security.createId('msg'),
            role: 'assistant',
            text: this.security.sanitize(text),
            timestamp: new Date().toISOString(),
            intent: type,
            results: [],
            actions: [],
            meta: { error: type !== 'success' }
        };
    }

    _createErrorResponse(error) {
        const friendlyMessage = this._modules.firebase?.getFriendlyErrorMessage?.(error)
            || 'Desculpe, ocorreu um erro. Tente novamente.';

        const response = this._createResponse('error', friendlyMessage);
        response.meta.error = true;
        response.meta.originalError = error.message;

        // Adiciona ações de recuperação
        response.actions = [
            this._modules.actions.createAction({
                type: ACTION_TYPES.SEARCH,
                label: '🔄 Tentar novamente',
                variant: ACTION_VARIANTS.PRIMARY,
                payload: { query: 'ajuda' }
            }),
            this._modules.actions.createAction({
                type: ACTION_TYPES.SEARCH,
                label: '💡 Ajuda',
                variant: ACTION_VARIANTS.GHOST,
                payload: { query: 'ajuda' }
            })
        ];

        return response;
    }

    // ==================== MÉTRICAS ====================

    _updateMetrics(responseTime, success) {
        this.metrics.messagesProcessed++;
        if (!success) this.metrics.errors++;

        // Média móvel simples
        const total = this.metrics.messagesProcessed;
        this.metrics.avgResponseTime = (
            (this.metrics.avgResponseTime * (total - 1)) + responseTime
        ) / total;
    }

    getMetrics() {
        const firebaseStats = this._modules.firebase?.getCacheStats?.() || {};
        const searchStats = this._modules.search?.exportState?.() || {};

        return {
            ...this.metrics,
            firebase: firebaseStats,
            search: searchStats,
            memory: this._modules.memory?.getCacheStats?.() || {},
            state: this.state
        };
    }

    // ==================== EVENTOS ====================

    /**
     * Registra listener de evento
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);

        return () => this.off(event, callback);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    _emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(cb => {
                try {
                    cb(data);
                } catch (err) {
                    this._log('error', `Erro no listener ${event}:`, err);
                }
            });
        }
    }

    // ==================== ESTADO ====================

    _setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this.state = newState;
            this._emit(ASSISTANT_EVENTS.STATE_CHANGED, { state: newState, previousState: oldState });
            this._log('debug', `Estado: ${oldState} → ${newState}`);
        }
    }

    getState() {
        return this.state;
    }

    isReady() {
        return this.state === ASSISTANT_STATE.READY;
    }

    // ==================== HANDLERS ONLINE/OFFLINE ====================

    _handleOnline() {
        this._log('info', 'Conexão restaurada');
        this._emit(ASSISTANT_EVENTS.CONNECTION_CHANGED, { online: true });
        // Firebase reconecta automaticamente via seus listeners
    }

    _handleOffline() {
        this._log('warn', 'Conexão perdida');
        this._emit(ASSISTANT_EVENTS.CONNECTION_CHANGED, { online: false });
        this._setState(ASSISTANT_STATE.OFFLINE);
    }

    // ==================== API PÚBLICA ====================

    /**
     * Processa mensagem (alias principal)
     */
    async sendMessage(input, options = {}) {
        return this.processMessage(input, options);
    }

    /**
     * Obtém histórico da conversa
     */
    getConversation(limit = null) {
        return this._modules.memory.getConversation(limit);
    }

    /**
     * Limpa conversa
     */
    clearConversation() {
        this._modules.memory.clearConversation();
        this._emit(ASSISTANT_EVENTS.STATE_CHANGED, { state: 'cleared' });
    }

    /**
     * Obtém perfil do visitante
     */
    getVisitorProfile() {
        return this._modules.memory.getVisitorProfile();
    }

    /**
     * Define nome do visitante
     */
    setVisitorName(name) {
        this._modules.memory.setVisitorName(name);
    }

    /**
     * Obtém sugestões de busca
     */
    async getSuggestions(query, limit = 5) {
        return this._modules.search.getSuggestions(query, limit);
    }

    /**
     * Busca direta
     */
    async search(query, options = {}) {
        return this._modules.search.search(query, options);
    }

    /**
     * Obtém projetos
     */
    async getProjects(options = {}) {
        return this._modules.knowledge.getProjects(options);
    }

    /**
     * Obtém posts
     */
    async getPosts(options = {}) {
        return this._modules.knowledge.getPosts(options);
    }

    /**
     * Exporta estado completo
     */
    exportState() {
        return {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            conversation: this._modules.memory.exportState(),
            metrics: this.getMetrics(),
            config: { ...this.config }
        };
    }

    /**
     * Importa estado
     */
    importState(state) {
        if (this._modules.memory.importState(state.conversation)) {
            this._log('info', 'Estado importado com sucesso');
            return true;
        }
        return false;
    }

    /**
     * Destrói o assistente
     */
    destroy() {
        // Limpa listeners globais
        window.removeEventListener('online', this._boundHandleOnline);
        window.removeEventListener('offline', this._boundHandleOffline);

        // Destrói módulos
        Object.values(this._modules).forEach(m => {
            if (m && typeof m.destroy === 'function') {
                m.destroy();
            }
        });

        // Limpa eventos
        this.eventListeners.clear();
        this._initialized = false;
        this._setState(ASSISTANT_STATE.INITIALIZING);

        this._log('info', 'Assistente destruído');
    }

    // ==================== UTILITÁRIOS ====================

    _log(level, ...args) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        if (levels[level] >= levels[this.config.logLevel]) {
            const prefix = `[Assistant:${level.toUpperCase()}]`;
            console[level](prefix, ...args);
        }
    }

    // Getters para módulos (para casos avançados)
    get intent() { return this._modules.intent; }
    get memory() { return this._modules.memory; }
    get knowledge() { return this._modules.knowledge; }
    get search() { return this._modules.search; }
    get responses() { return this._modules.responses; }
    get actions() { return this._modules.actions; }
    get firebase() { return this._modules.firebase; }
}

// Instância singleton
export const assistant = new Assistant();

// Disponibiliza globalmente
if (typeof window !== 'undefined') {
    window.__Assistant = assistant;
    window.assistant = assistant; // Atalho para console
}

// Auto-inicialização se não estiver em módulo
if (typeof document !== 'undefined' && document.readyState !== 'loading') {
    assistant.init().catch(err => console.error('[Assistant] Auto-init falhou:', err));
} else if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        assistant.init().catch(err => console.error('[Assistant] Auto-init falhou:', err));
    });
}