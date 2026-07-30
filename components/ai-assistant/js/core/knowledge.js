/**
 * knowledge.js - Base de conhecimento sincronizada com Firebase
 *
 * Responsabilidades:
 * - Consumir cache do firebaseService
 * - Fornecer API unificada de acesso aos dados do Blog Secreto
 * - Enriquecer dados com relacionamentos (projetos <-> tags, posts <-> categorias)
 * - Busca textual local no cache
 * - Cache de consultas frequentes
 */

import { firebaseService, COLLECTIONS, SERVICE_EVENTS } from '../services/firebaseService.js';
import { StorageManager } from '../services/StorageManager.js';

/**
 * KnowledgeBase - Acesso unificado à base de conhecimento do Blog Secreto
 */
export class KnowledgeBase {
    constructor(options = {}) {
        this.firebaseService = options.firebaseService || firebaseService;
        this.storage = options.storage || new StorageManager('secreto_ai_knowledge');
        this.cache = new Map(); // cache de consultas enriquecidas
        this.cacheConfig = {
            maxAge: 2 * 60 * 1000, // 2 minutos para consultas enriquecidas
            maxSize: 100
        };
        this.enrichmentCache = new Map(); // cache de enriquecimentos (tags -> projetos, etc.)
        this.initialized = false;
        this.initPromise = null;
        this.unsubscribers = [];

        // Inicializa automaticamente
        this.init();
    }

    /**
     * Inicializa a base de conhecimento
     */
    async init() {
        if (this.initialized) return this.initPromise;

        this.initPromise = this._doInit();
        return this.initPromise;
    }

    async _doInit() {
        try {
            // Aguarda Firebase estar pronto
            await this.firebaseService.init();

            // Configura listeners para invalidar cache quando dados mudarem
            this._setupCacheInvalidation();

            // Pré-carrega collections principais
            await this._warmCache();

            this.initialized = true;
            console.log('[KnowledgeBase] Inicializado com sucesso');
        } catch (error) {
            console.error('[KnowledgeBase] Falha ao inicializar:', error);
            // Tenta usar cache local do StorageManager como fallback
            this._loadLocalFallback();
        }
    }

    /**
     * Configura invalidação de cache baseada em eventos do firebaseService
     */
    _setupCacheInvalidation() {
        // Invalida cache quando dados do Firebase mudam
        const unsubscribe = this.firebaseService.on(SERVICE_EVENTS.DATA_UPDATED, (event) => {
            this._invalidateRelatedCache(event.collection);
        });
        this.unsubscribers.push(unsubscribe);

        // Invalida cache local quando Firebase reconecta
        const unsubscribeConn = this.firebaseService.on(SERVICE_EVENTS.CONNECTION_CHANGED, (state) => {
            if (state === 'connected') {
                this._invalidateAllCache();
                this._warmCache();
            }
        });
        this.unsubscribers.push(unsubscribeConn);
    }

    /**
     * Pré-carrega collections essenciais
     */
    async _warmCache() {
        try {
            await Promise.allSettled([
                this.firebaseService.getProjects(),
                this.firebaseService.getPosts(),
                this.firebaseService.getTags(),
                this.firebaseService.getCategories(),
                this.firebaseService.getFAQ(),
                this.firebaseService.getPublicSettings()
            ]);
            console.log('[KnowledgeBase] Cache aquecido');
        } catch (error) {
            console.warn('[KnowledgeBase] Erro ao aquecer cache:', error);
        }
    }

    /**
     * Carrega fallback do localStorage se Firebase falhar
     */
    _loadLocalFallback() {
        try {
            const localProjects = this.storage.getProjects();
            const localTags = this.storage.getTags?.() || [];
            const localCategories = this.storage.getCategories?.() || [];

            if (localProjects.length > 0) {
                this.firebaseService.setCache('projetos', localProjects);
            }
            if (localTags.length > 0) {
                this.firebaseService.setCache('tags', localTags);
            }
            if (localCategories.length > 0) {
                this.firebaseService.setCache('categorias', localCategories);
            }
            console.log('[KnowledgeBase] Fallback local carregado');
        } catch (error) {
            console.warn('[KnowledgeBase] Sem fallback local disponível');
        }
    }

    /**
     * Invalida cache relacionado a uma collection
     */
    _invalidateRelatedCache(collectionName) {
        // Invalida cache direto
        this.cache.clear();
        this.enrichmentCache.delete(collectionName);

        // Invalida caches relacionados
        const relations = {
            'projetos': ['tags', 'categorias'],
            'posts': ['tags', 'categorias'],
            'tags': ['projetos', 'posts'],
            'categorias': ['projetos', 'posts']
        };

        if (relations[collectionName]) {
            relations[collectionName].forEach(col => {
                this.enrichmentCache.delete(col);
            });
        }
    }

    /**
     * Invalida todo o cache
     */
    _invalidateAllCache() {
        this.cache.clear();
        this.enrichmentCache.clear();
    }

    /**
     * Verifica se cache de consulta é válido
     */
    _isQueryCacheValid(key) {
        const cached = this.cache.get(key);
        if (!cached) return false;
        return Date.now() - cached.timestamp < this.cacheConfig.maxAge;
    }

    /**
     * Armazena no cache de consultas
     */
    _setQueryCache(key, data) {
        // Limpa cache antigo se exceder tamanho
        if (this.cache.size >= this.cacheConfig.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, {
            data: this._deepClone(data),
            timestamp: Date.now()
        });
    }

    /**
     * Obtém do cache de consultas
     */
    _getQueryCache(key) {
        const cached = this.cache.get(key);
        return cached ? cached.data : null;
    }

    // ==================== PROJETOS ====================

    /**
     * Obtém todos os projetos publicados (com cache)
     */
    async getProjects(options = {}) {
        const { useCache = true, enrich = true } = options;
        const cacheKey = `projects:${useCache}:${enrich}`;

        if (useCache && this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        try {
            let projects = await this.firebaseService.getProjects();

            if (enrich) {
                projects = await this._enrichProjects(projects);
            }

            this._setQueryCache(cacheKey, projects);
            return projects;
        } catch (error) {
            console.error('[KnowledgeBase] Erro ao buscar projetos:', error);
            return this._getFallbackProjects();
        }
    }

    /**
     * Obtém projeto por ID (com enriquecimento)
     */
    async getProjectById(id, options = {}) {
        const { enrich = true } = options;
        const cacheKey = `project:${id}:${enrich}`;

        if (this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        try {
            const project = await this.firebaseService.getById(COLLECTIONS.PROJECTS, id);
            if (project && enrich) {
                return this._enrichProject(project);
            }
            return project;
        } catch (error) {
            console.error(`[KnowledgeBase] Erro ao buscar projeto ${id}:`, error);
            const fallback = this._getFallbackProjects().find(p => p.id === id);
            if (fallback && enrich) return this._enrichProject(fallback);
            return fallback || null;
        }
    }

    /**
     * Busca projetos por termo (busca textual no cache)
     */
    searchProjects(query, options = {}) {
        const { fields = ['nome', 'descricao', 'tecnologias', 'tags', 'categoria'], limit = 20 } = options;

        try {
            const results = this.firebaseService.searchInCache(COLLECTIONS.PROJECTS, query, fields);
            return results.slice(0, limit);
        } catch (error) {
            console.error('[KnowledgeBase] Erro na busca de projetos:', error);
            return [];
        }
    }

    /**
     * Projetos por tag
     */
    async getProjectsByTag(tag, options = {}) {
        const cacheKey = `projectsByTag:${tag}`;
        if (this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        const projects = await this.getProjects({ enrich: true });
        const results = projects.filter(p =>
            p.tecnologias?.some(t => t.toLowerCase() === tag.toLowerCase()) ||
            p.tags?.some(t => t.toLowerCase() === tag.toLowerCase())
        );

        this._setQueryCache(cacheKey, results);
        return results;
    }

    /**
     * Projetos por categoria
     */
    async getProjectsByCategory(category, options = {}) {
        const cacheKey = `projectsByCategory:${category}`;
        if (this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        const projects = await this.getProjects({ enrich: true });
        const results = projects.filter(p =>
            p.categoria?.toLowerCase() === category.toLowerCase()
        );

        this._setQueryCache(cacheKey, results);
        return results;
    }

    /**
     * Projetos relacionados (compartilham tags/categoria)
     */
    async getRelatedProjects(projectId, options = {}) {
        const { limit = 5 } = options;
        const project = await this.getProjectById(projectId, { enrich: true });
        if (!project) return [];

        const projects = await this.getProjects({ enrich: true });
        const otherProjects = projects.filter(p => p.id !== projectId);

        // Score baseado em tags e categoria compartilhadas
        const scored = otherProjects.map(p => {
            let score = 0;
            const projectTags = [...(project.tecnologias || []), ...(project.tags || [])];
            const pTags = [...(p.tecnologias || []), ...(p.tags || [])];

            projectTags.forEach(tag => {
                if (pTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
                    score += 2;
                }
            });

            if (project.categoria && p.categoria === project.categoria) {
                score += 3;
            }

            return { project: p, score };
        });

        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.project);
    }

    // ==================== POSTS ====================

    /**
     * Obtém posts publicados
     */
    async getPosts(options = {}) {
        const { useCache = true, enrich = true, limit } = options;
        const cacheKey = `posts:${useCache}:${enrich}:${limit || 'all'}`;

        if (useCache && this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        try {
            let posts = await this.firebaseService.getPosts({ limit });

            if (enrich) {
                posts = await this._enrichPosts(posts);
            }

            this._setQueryCache(cacheKey, posts);
            return posts;
        } catch (error) {
            console.error('[KnowledgeBase] Erro ao buscar posts:', error);
            return [];
        }
    }

    /**
     * Post por ID
     */
    async getPostById(id, options = {}) {
        const { enrich = true } = options;
        const cacheKey = `post:${id}:${enrich}`;

        if (this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        try {
            const post = await this.firebaseService.getById(COLLECTIONS.POSTS, id);
            if (post && enrich) {
                return await this._enrichPost(post);
            }
            return post;
        } catch (error) {
            console.error(`[KnowledgeBase] Erro ao buscar post ${id}:`, error);
            return null;
        }
    }

    /**
     * Busca posts
     */
    searchPosts(query, options = {}) {
        const { fields = ['titulo', 'descricao', 'conteudo', 'tags', 'categoria'], limit = 20 } = options;

        try {
            return this.firebaseService.searchInCache(COLLECTIONS.POSTS, query, fields).slice(0, limit);
        } catch (error) {
            console.error('[KnowledgeBase] Erro na busca de posts:', error);
            return [];
        }
    }

    /**
     * Posts recentes
     */
    async getRecentPosts(limit = 5) {
        return this.getPosts({ limit, enrich: true });
    }

    // ==================== TAGS ====================

    /**
     * Obtém todas as tags
     */
    async getTags(options = {}) {
        const { useCache = true, withCounts = false } = options;
        const cacheKey = `tags:${useCache}:${withCounts}`;

        if (useCache && this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        try {
            let tags = await this.firebaseService.getTags();

            if (withCounts) {
                tags = await this._enrichTagsWithCounts(tags);
            }

            this._setQueryCache(cacheKey, tags);
            return tags;
        } catch (error) {
            console.error('[KnowledgeBase] Erro ao buscar tags:', error);
            return [];
        }
    }

    /**
     * Tags populares (mais usadas em projetos/posts)
     */
    async getPopularTags(limit = 20, options = {}) {
        const tags = await this.getTags({ withCounts: true });
        return tags
            .filter(t => t.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    // ==================== CATEGORIAS ====================

    /**
     * Obtém categorias
     */
    async getCategories(options = {}) {
        const { useCache = true, withCounts = false } = options;
        const cacheKey = `categories:${useCache}:${withCounts}`;

        if (useCache && this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        try {
            let categories = await this.firebaseService.getCategories();

            if (withCounts) {
                categories = await this._enrichCategoriesWithCounts(categories);
            }

            this._setQueryCache(cacheKey, categories);
            return categories;
        } catch (error) {
            console.error('[KnowledgeBase] Erro ao buscar categorias:', error);
            return [];
        }
    }

    // ==================== FAQ & SETTINGS ====================

    /**
     * FAQ ativo
     */
    async getFAQ() {
        const cacheKey = 'faq';
        if (this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        try {
            const faq = await this.firebaseService.getFAQ();
            this._setQueryCache(cacheKey, faq);
            return faq;
        } catch (error) {
            console.error('[KnowledgeBase] Erro ao buscar FAQ:', error);
            return [];
        }
    }

    /**
     * Configurações públicas
     */
    async getSettings() {
        const cacheKey = 'settings';
        if (this._isQueryCacheValid(cacheKey)) {
            return this._getQueryCache(cacheKey);
        }

        try {
            const settings = await this.firebaseService.getPublicSettings();
            this._setQueryCache(cacheKey, settings);
            return settings;
        } catch (error) {
            console.error('[KnowledgeBase] Erro ao buscar configurações:', error);
            return [];
        }
    }

    // ==================== ENRIQUECIMENTO ====================

    /**
     * Enriquece lista de projetos com tags, categorias, contagens
     */
    async _enrichProjects(projects) {
        const [tags, categories] = await Promise.all([
            this.getTags(),
            this.getCategories()
        ]);

        const tagMap = new Map(tags.map(t => [t.slug || t.nome.toLowerCase(), t]));
        const catMap = new Map(categories.map(c => [c.slug || c.nome.toLowerCase(), c]));

        return projects.map(project => this._enrichProject(project, tagMap, catMap));
    }

    /**
     * Enriquece um projeto
     */
    _enrichProject(project, tagMap = null, catMap = null) {
        const enriched = { ...project };

        // Normaliza tecnologias
        if (enriched.tecnologias) {
            enriched.tecnologias = enriched.tecnologias
                .map(t => typeof t === 'string' ? t.trim() : t?.nome || '')
                .filter(Boolean);
        }

        // Adiciona info de tags (cor, ícone, categoria)
        if (tagMap && enriched.tecnologias) {
            enriched.tecnologiasDetalhadas = enriched.tecnologias
                .map(tagName => tagMap.get(tagName.toLowerCase()))
                .filter(Boolean);
        }

        // Adiciona info de categoria
        if (catMap && enriched.categoria) {
            enriched.categoriaDetalhada = catMap.get(enriched.categoria.toLowerCase());
        }

        // Adiciona contagem de visualizações se disponível
        if (enriched.views !== undefined) {
            enriched.viewsFormatado = this._formatNumber(enriched.views);
        }

        // Adiciona data formatada
        if (enriched.dataCriacao) {
            enriched.dataFormatada = this._formatDate(enriched.dataCriacao);
        }

        return enriched;
    }

    /**
     * Enriquece posts com categorias, tags, autor
     */
    async _enrichPosts(posts) {
        const [tags, categories] = await Promise.all([
            this.getTags(),
            this.getCategories()
        ]);

        const tagMap = new Map(tags.map(t => [t.slug || t.nome.toLowerCase(), t]));
        const catMap = new Map(categories.map(c => [c.slug || c.nome.toLowerCase(), c]));

        return posts.map(post => this._enrichPost(post, tagMap, catMap));
    }

    _enrichPost(post, tagMap = null, catMap = null) {
        const enriched = { ...post };

        if (tagMap && enriched.tags) {
            enriched.tagsDetalhadas = enriched.tags
                .map(tagName => tagMap.get(tagName.toLowerCase()))
                .filter(Boolean);
        }

        if (catMap && enriched.categoria) {
            enriched.categoriaDetalhada = catMap.get(enriched.categoria.toLowerCase());
        }

        if (enriched.tempoLeitura) {
            enriched.tempoLeituraFormatado = `${enriched.tempoLeitura} min de leitura`;
        }

        if (enriched.dataPublicacao) {
            enriched.dataFormatada = this._formatDate(enriched.dataPublicacao);
        }

        return enriched;
    }

    /**
     * Enriquece tags com contagem de uso
     */
    async _enrichTagsWithCounts(tags) {
        const [projects, posts] = await Promise.all([
            this.firebaseService.getAll(COLLECTIONS.PROJECTS, { useCache: true }),
            this.firebaseService.getAll(COLLECTIONS.POSTS, { useCache: true })
        ]);

        const tagCounts = new Map();

        // Conta em projetos
        projects.forEach(p => {
            [...(p.tecnologias || []), ...(p.tags || [])].forEach(tag => {
                const key = tag.toLowerCase();
                tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
            });
        });

        // Conta em posts
        posts.forEach(p => {
            (p.tags || []).forEach(tag => {
                const key = tag.toLowerCase();
                tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
            });
        });

        return tags.map(tag => ({
            ...tag,
            count: tagCounts.get(tag.slug?.toLowerCase() || tag.nome.toLowerCase()) || 0
        }));
    }

    /**
     * Enriquece categorias com contagem
     */
    async _enrichCategoriesWithCounts(categories) {
        const [projects, posts] = await Promise.all([
            this.firebaseService.getAll(COLLECTIONS.PROJECTS, { useCache: true }),
            this.firebaseService.getAll(COLLECTIONS.POSTS, { useCache: true })
        ]);

        const catCounts = new Map();

        projects.forEach(p => {
            if (p.categoria) {
                const key = p.categoria.toLowerCase();
                catCounts.set(key, (catCounts.get(key) || 0) + 1);
            }
        });

        posts.forEach(p => {
            if (p.categoria) {
                const key = p.categoria.toLowerCase();
                catCounts.set(key, (catCounts.get(key) || 0) + 1);
            }
        });

        return categories.map(cat => ({
            ...cat,
            count: catCounts.get(cat.slug?.toLowerCase() || cat.nome.toLowerCase()) || 0
        }));
    }

    // ==================== UTILITÁRIOS ====================

    _formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return String(num);
    }

    _formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    _getFallbackProjects() {
        try {
            return this.storage.getProjects();
        } catch {
            return [];
        }
    }

    // ==================== SUBSCRIPTIONS TEMPO REAL ====================

    /**
     * Inscreve em projetos em tempo real
     */
    subscribeToProjects(callback, options = {}) {
        return this.firebaseService.subscribeToProjects(callback, options);
    }

    /**
     * Inscreve em posts em tempo real
     */
    subscribeToPosts(callback, options = {}) {
        return this.firebaseService.subscribeToPosts(callback, options);
    }

    /**
     * Inscreve em tags em tempo real
     */
    subscribeToTags(callback, options = {}) {
        return this.firebaseService.subscribeToTags(callback, options);
    }

    // ==================== ESTADO DA CONEXÃO ====================

    getConnectionState() {
        return this.firebaseService.getConnectionState();
    }

    isOnline() {
        return this.firebaseService.isOnline();
    }

    onConnectionChange(callback) {
        return this.firebaseService.on(SERVICE_EVENTS.CONNECTION_CHANGED, callback);
    }

    onError(callback) {
        return this.firebaseService.on(SERVICE_EVENTS.ERROR, callback);
    }

    // ==================== LIMPEZA ====================

    destroy() {
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
        this.cache.clear();
        this.enrichmentCache.clear();
        this.initialized = false;
    }

    clearCache() {
        this.cache.clear();
        this.enrichmentCache.clear();
    }

    getCacheStats() {
        return {
            queries: this.cache.size,
            enrichments: this.enrichmentCache.size,
            firebase: this.firebaseService.getCacheStats()
        };
    }
}

// Exporta instância singleton
export const knowledgeBase = new KnowledgeBase();