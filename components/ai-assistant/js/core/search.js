/**
 * search.js - Busca inteligente com cache e múltiplas estratégias
 *
 * Responsabilidades:
 * - Busca multi-fonte (projetos, posts, tags, categorias, FAQ)
 * - Ranking de relevância combinado
 * - Cache de resultados de busca
 * - Sugestões e autocomplete
 * - Histórico de buscas do usuário
 * - Filtros avançados
 */

import { knowledgeBase } from './knowledge.js';
import { firebaseService, COLLECTIONS } from '../services/firebaseService.js';
import { StorageManager } from '../services/StorageManager.js';
import { SecurityManager } from './SecurityManager.js';

/**
 * Configuração de pesos para ranking
 */
const RANKING_WEIGHTS = {
    exactTitleMatch: 100,
    partialTitleMatch: 50,
    tagMatch: 30,
    categoryMatch: 25,
    descriptionMatch: 15,
    technologyMatch: 20,
    recentBoost: 10,
    popularBoost: 5
};

/**
 * Tipos de busca
 */
export const SEARCH_TYPES = Object.freeze({
    ALL: 'all',
    PROJECTS: 'projects',
    POSTS: 'posts',
    TAGS: 'tags',
    CATEGORIES: 'categories',
    FAQ: 'faq'
});

/**
 * SearchEngine - Motor de busca inteligente
 */
export class SearchEngine {
    constructor(options = {}) {
        this.knowledge = options.knowledge || knowledgeBase;
        this.firebase = options.firebase || firebaseService;
        this.storage = options.storage || new StorageManager('secreto_ai_search');
        this.maxHistorySize = 50;
        this.cache = new Map();
        this.cacheConfig = {
            maxAge: 60 * 1000, // 1 minuto
            maxSize: 200
        };
        this.initialized = false;
    }

    /**
     * Inicializa o motor de busca
     */
    async init() {
        if (this.initialized) return;
        await this.knowledge.init();
        this._loadSearchHistory();
        this.initialized = true;
    }

    /**
     * Busca principal - multi-fonte com ranking unificado
     */
    async search(query, options = {}) {
        const {
            type = SEARCH_TYPES.ALL,
            limit = 10,
            filters = {},
            useCache = true,
            trackHistory = true
        } = options;

        if (!query || !query.trim()) {
            return { results: [], suggestions: [], query: '' };
        }

        const normalizedQuery = query.trim();
        const cacheKey = this._buildCacheKey(normalizedQuery, type, filters, limit);

        // Verifica cache
        if (useCache) {
            const cached = this._getCache(cacheKey);
            if (cached) {
                return { ...cached, fromCache: true };
            }
        }

        // Registra no histórico
        if (trackHistory) {
            this._addToHistory(normalizedQuery);
        }

        try {
            let results = [];

            switch (type) {
                case SEARCH_TYPES.ALL:
                    results = await this._searchAll(normalizedQuery, filters, limit);
                    break;
                case SEARCH_TYPES.PROJECTS:
                    results = await this._searchProjects(normalizedQuery, filters, limit);
                    break;
                case SEARCH_TYPES.POSTS:
                    results = await this._searchPosts(normalizedQuery, filters, limit);
                    break;
                case SEARCH_TYPES.TAGS:
                    results = await this._searchTags(normalizedQuery, limit);
                    break;
                case SEARCH_TYPES.CATEGORIES:
                    results = await this._searchCategories(normalizedQuery, limit);
                    break;
                case SEARCH_TYPES.FAQ:
                    results = await this._searchFAQ(normalizedQuery, limit);
                    break;
                default:
                    results = await this._searchAll(normalizedQuery, filters, limit);
            }

            // Aplica ranking e ordena
            const ranked = this._rankResults(results, normalizedQuery, filters);
            const finalResults = ranked.slice(0, limit);

            const response = {
                results: finalResults,
                query: normalizedQuery,
                total: ranked.length,
                suggestions: await this.getSuggestions(normalizedQuery),
                filters: this._getAvailableFilters(ranked),
                took: 0 // será preenchido pelo caller
            };

            // Salva no cache
            this._setCache(cacheKey, response);

            return response;
        } catch (error) {
            console.error('[SearchEngine] Erro na busca:', error);
            return {
                results: [],
                suggestions: await this.getSuggestions(normalizedQuery),
                query: normalizedQuery,
                error: error.message
            };
        }
    }

    /**
     * Busca em todas as fontes
     */
    async _searchAll(query, filters, limit) {
        const [projects, posts, tags, categories, faq] = await Promise.allSettled([
            this._searchProjects(query, filters, limit),
            this._searchPosts(query, filters, limit),
            this._searchTags(query, limit),
            this._searchCategories(query, limit),
            this._searchFAQ(query, limit)
        ]);

        const results = [];

        if (projects.status === 'fulfilled') {
            results.push(...projects.value.map(r => ({ ...r, source: 'projects' })));
        }
        if (posts.status === 'fulfilled') {
            results.push(...posts.value.map(r => ({ ...r, source: 'posts' })));
        }
        if (tags.status === 'fulfilled') {
            results.push(...tags.value.map(r => ({ ...r, source: 'tags' })));
        }
        if (categories.status === 'fulfilled') {
            results.push(...categories.value.map(r => ({ ...r, source: 'categories' })));
        }
        if (faq.status === 'fulfilled') {
            results.push(...faq.value.map(r => ({ ...r, source: 'faq' })));
        }

        return results;
    }

    /**
     * Busca projetos
     */
    async _searchProjects(query, filters, limit) {
        const projects = await this.knowledge.getProjects({ enrich: true });
        const searchTerm = SecurityManager.normalizeForSearch(query);

        return projects
            .filter(p => this._matchesFilters(p, filters))
            .map(p => ({
                ...this._projectToSearchResult(p, query),
                type: 'project'
            }));
    }

    /**
     * Busca posts
     */
    async _searchPosts(query, filters, limit) {
        const posts = await this.knowledge.getPosts({ enrich: true, limit: limit * 2 });
        const searchTerm = SecurityManager.normalizeForSearch(query);

        return posts
            .filter(p => this._matchesFilters(p, filters))
            .map(p => ({
                ...this._postToSearchResult(p, query),
                type: 'post'
            }));
    }

    /**
     * Busca tags
     */
    async _searchTags(query, limit) {
        const tags = await this.knowledge.getTags({ withCounts: true });
        const searchTerm = SecurityManager.normalizeForSearch(query);

        return tags
            .filter(t => SecurityManager.normalizeForSearch(t.nome).includes(searchTerm) ||
                         t.slug?.includes(searchTerm))
            .slice(0, limit)
            .map(t => ({
                id: t.id || t.slug,
                type: 'tag',
                title: t.nome,
                description: `${t.count || 0} conteúdos com esta tag`,
                href: `/tags/${t.slug || t.nome.toLowerCase()}`,
                tags: [],
                score: 0,
                raw: t
            }));
    }

    /**
     * Busca categorias
     */
    async _searchCategories(query, limit) {
        const categories = await this.knowledge.getCategories({ withCounts: true });
        const searchTerm = SecurityManager.normalizeForSearch(query);

        return categories
            .filter(c => SecurityManager.normalizeForSearch(c.nome).includes(searchTerm) ||
                         c.slug?.includes(searchTerm))
            .slice(0, limit)
            .map(c => ({
                id: c.id || c.slug,
                type: 'category',
                title: c.nome,
                description: `${c.count || 0} conteúdos nesta categoria`,
                href: `/categoria/${c.slug || c.nome.toLowerCase()}`,
                tags: [],
                score: 0,
                raw: c
            }));
    }

    /**
     * Busca FAQ
     */
    async _searchFAQ(query, limit) {
        const faq = await this.knowledge.getFAQ();
        const searchTerm = SecurityManager.normalizeForSearch(query);

        return faq
            .filter(f => SecurityManager.normalizeForSearch(f.pergunta).includes(searchTerm) ||
                         SecurityManager.normalizeForSearch(f.resposta).includes(searchTerm))
            .slice(0, limit)
            .map(f => ({
                id: f.id,
                type: 'faq',
                title: f.pergunta,
                description: f.resposta.substring(0, 150) + (f.resposta.length > 150 ? '...' : ''),
                href: `#faq-${f.id}`,
                tags: f.tags || [],
                score: 0,
                raw: f
            }));
    }

    /**
     * Converte projeto para resultado de busca
     */
    _projectToSearchResult(project, query) {
        const searchTerm = SecurityManager.normalizeForSearch(query);
        const title = SecurityManager.normalizeForSearch(project.nome || '');
        const description = SecurityManager.normalizeForSearch(project.descricao || '');
        const techs = (project.tecnologias || []).map(t => SecurityManager.normalizeForSearch(t));
        const tags = (project.tags || []).map(t => SecurityManager.normalizeForSearch(t));
        const category = project.categoria ? SecurityManager.normalizeForSearch(project.categoria) : '';

        return {
            id: project.id,
            type: 'project',
            title: project.nome,
            description: project.descricao || 'Sem descrição',
            href: project.link || `#projeto-${project.id}`,
            tags: [...project.tecnologias || [], ...project.tags || []],
            score: 0,
            raw: project,
            // Metadata para ranking
            _searchMeta: {
                titleMatch: title === searchTerm ? 'exact' : title.includes(searchTerm) ? 'partial' : 'none',
                descMatch: description.includes(searchTerm),
                techMatch: techs.some(t => t.includes(searchTerm)),
                tagMatch: tags.some(t => t.includes(searchTerm)),
                catMatch: category.includes(searchTerm),
                date: project.dataCriacao,
                views: project.views || 0
            }
        };
    }

    /**
     * Converte post para resultado de busca
     */
    _postToSearchResult(post, query) {
        const searchTerm = SecurityManager.normalizeForSearch(query);
        const title = SecurityManager.normalizeForSearch(post.titulo || '');
        const description = SecurityManager.normalizeForSearch(post.descricao || '');
        const content = SecurityManager.normalizeForSearch(post.conteudo || '');
        const tags = (post.tags || []).map(t => SecurityManager.normalizeForSearch(t));
        const category = post.categoria ? SecurityManager.normalizeForSearch(post.categoria) : '';

        return {
            id: post.id,
            type: 'post',
            title: post.titulo,
            description: post.descricao || 'Sem descrição',
            href: post.link || `/post/${post.slug || post.id}`,
            tags: post.tags || [],
            score: 0,
            raw: post,
            _searchMeta: {
                titleMatch: title === searchTerm ? 'exact' : title.includes(searchTerm) ? 'partial' : 'none',
                descMatch: description.includes(searchTerm) || content.includes(searchTerm),
                tagMatch: tags.some(t => t.includes(searchTerm)),
                catMatch: category.includes(searchTerm),
                date: post.dataPublicacao,
                views: post.views || 0
            }
        };
    }

    /**
     * Verifica se item passa nos filtros
     */
    _matchesFilters(item, filters) {
        if (!filters || Object.keys(filters).length === 0) return true;

        // Filtro de status
        if (filters.status && item.status !== filters.status) return false;

        // Filtro de tecnologia
        if (filters.technology) {
            const techs = [...(item.tecnologias || []), ...(item.tags || [])].map(t => t.toLowerCase());
            if (!techs.includes(filters.technology.toLowerCase())) return false;
        }

        // Filtro de categoria
        if (filters.category && item.categoria !== filters.category) return false;

        // Filtro de data (últimos N dias)
        if (filters.recentDays) {
            const itemDate = new Date(item.dataCriacao || item.dataPublicacao);
            const cutoff = new Date(Date.now() - filters.recentDays * 24 * 60 * 60 * 1000);
            if (itemDate < cutoff) return false;
        }

        return true;
    }

    /**
     * Ranking de relevância
     */
    _rankResults(results, query, filters) {
        const searchTerm = SecurityManager.normalizeForSearch(query);

        return results.map(result => {
            const meta = result._searchMeta || {};
            let score = 0;

            // Match exato no título
            if (meta.titleMatch === 'exact') score += RANKING_WEIGHTS.exactTitleMatch;
            else if (meta.titleMatch === 'partial') score += RANKING_WEIGHTS.partialTitleMatch;

            // Match na descrição/conteúdo
            if (meta.descMatch) score += RANKING_WEIGHTS.descriptionMatch;

            // Match em tags/tecnologias
            if (meta.techMatch) score += RANKING_WEIGHTS.technologyMatch;
            if (meta.tagMatch) score += RANKING_WEIGHTS.tagMatch;

            // Match em categoria
            if (meta.catMatch) score += RANKING_WEIGHTS.categoryMatch;

            // Boost por recência (últimos 30 dias)
            if (meta.date) {
                const itemDate = new Date(meta.date);
                const daysOld = (Date.now() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysOld <= 30) score += RANKING_WEIGHTS.recentBoost * (1 - daysOld / 30);
            }

            // Boost por popularidade (views)
            if (meta.views > 1000) score += RANKING_WEIGHTS.popularBoost * 2;
            else if (meta.views > 100) score += RANKING_WEIGHTS.popularBoost;

            // Boost se filtro específico foi aplicado e item passa
            if (filters.technology && meta.techMatch) score += 20;
            if (filters.category && meta.catMatch) score += 15;

            return { ...result, score };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * Retorna filtros disponíveis baseados nos resultados
     */
    _getAvailableFilters(results) {
        const technologies = new Set();
        const categories = new Set();
        const types = new Set();

        results.forEach(r => {
            types.add(r.type);
            if (r.raw?.tecnologias) r.raw.tecnologias.forEach(t => technologies.add(t));
            if (r.raw?.tags) r.raw.tags.forEach(t => technologies.add(t));
            if (r.raw?.categoria) categories.add(r.raw.categoria);
        });

        return {
            types: [...types],
            technologies: [...technologies].sort(),
            categories: [...categories].sort()
        };
    }

    /**
     * Sugestões de busca (autocomplete)
     */
    async getSuggestions(query, limit = 5) {
        if (!query || query.length < 2) {
            return this.getPopularSearches(limit);
        }

        const cacheKey = `suggestions:${query.toLowerCase()}`;
        if (this._isCacheValid(cacheKey)) {
            return this._getCache(cacheKey) || [];
        }

        try {
            const [projects, posts, tags] = await Promise.allSettled([
                this.knowledge.getProjects({ enrich: false }),
                this.knowledge.getPosts({ enrich: false, limit: 50 }),
                this.knowledge.getTags({ withCounts: true })
            ]);

            const suggestions = new Set();
            const searchTerm = query.toLowerCase();

            // Títulos de projetos
            if (projects.status === 'fulfilled') {
                projects.value.forEach(p => {
                    if (p.nome.toLowerCase().includes(searchTerm)) {
                        suggestions.add(p.nome);
                    }
                });
            }

            // Títulos de posts
            if (posts.status === 'fulfilled') {
                posts.value.forEach(p => {
                    if (p.titulo.toLowerCase().includes(searchTerm)) {
                        suggestions.add(p.titulo);
                    }
                });
            }

            // Tags populares
            if (tags.status === 'fulfilled') {
                tags.value
                    .filter(t => t.nome.toLowerCase().includes(searchTerm))
                    .slice(0, 10)
                    .forEach(t => suggestions.add(t.nome));
            }

            const result = [...suggestions].slice(0, limit);
            this._setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('[SearchEngine] Erro ao buscar sugestões:', error);
            return this.getPopularSearches(limit);
        }
    }

    /**
     * Buscas populares do histórico
     */
    getPopularSearches(limit = 5) {
        const history = this._getSearchHistory();
        const counts = new Map();

        history.forEach(q => {
            counts.set(q, (counts.get(q) || 0) + 1);
        });

        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([q]) => q);
    }

    /**
     * Busca por ID específico (projeto, post, etc.)
     */
    async getById(type, id) {
        switch (type) {
            case 'project':
                return this.knowledge.getProjectById(id);
            case 'post':
                return this.knowledge.getPostById(id);
            case 'tag':
                const tags = await this.knowledge.getTags();
                return tags.find(t => t.id === id || t.slug === id) || null;
            case 'category':
                const cats = await this.knowledge.getCategories();
                return cats.find(c => c.id === id || c.slug === id) || null;
            default:
                return null;
        }
    }

    /**
     * Busca relacionada (itens similares)
     */
    async getRelated(item, type, limit = 5) {
        if (type === 'project') {
            return this.knowledge.getRelatedProjects(item.id, { limit });
        }
        // Para posts, buscar por tags/categoria semelhantes
        if (type === 'post' && item.tags?.length) {
            const allPosts = await this.knowledge.getPosts({ enrich: true });
            const related = allPosts
                .filter(p => p.id !== item.id)
                .map(p => {
                    const shared = p.tags?.filter(t => item.tags.includes(t)).length || 0;
                    return { ...p, _sharedTags: shared };
                })
                .filter(p => p._sharedTags > 0)
                .sort((a, b) => b._sharedTags - a._sharedTags)
                .slice(0, limit);
            return related;
        }
        return [];
    }

    // ==================== CACHE ====================

    _buildCacheKey(query, type, filters, limit) {
        return `search:${type}:${query.toLowerCase()}:${JSON.stringify(filters)}:${limit}`;
    }

    _isCacheValid(key) {
        const cached = this.cache.get(key);
        if (!cached) return false;
        return Date.now() - cached.timestamp < this.cacheConfig.maxAge;
    }

    _getCache(key) {
        const cached = this.cache.get(key);
        return cached ? cached.data : null;
    }

    _setCache(key, data) {
        if (this.cache.size >= this.cacheConfig.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, {
            data: this._deepClone(data),
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    // ==================== HISTÓRICO ====================

    _loadSearchHistory() {
        try {
            const stored = this.storage.read('searchHistory', []);
            if (Array.isArray(stored)) {
                this.searchHistory = stored.slice(-this.maxHistorySize);
            }
        } catch {
            this.searchHistory = [];
        }
    }

    _getSearchHistory() {
        return this.searchHistory || [];
    }

    _addToHistory(query) {
        if (!this.searchHistory) this.searchHistory = [];

        // Remove duplicatas
        this.searchHistory = this.searchHistory.filter(q => q.toLowerCase() !== query.toLowerCase());

        // Adiciona no início
        this.searchHistory.unshift(query);

        // Limita tamanho
        this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);

        // Persiste
        this.storage.write('searchHistory', this.searchHistory);
    }

    getHistory(limit = 10) {
        return this._getSearchHistory().slice(0, limit);
    }

    clearHistory() {
        this.searchHistory = [];
        this.storage.write('searchHistory', []);
    }

    // ==================== UTILITÁRIOS ====================

    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Exporta estado do motor de busca
     */
    exportState() {
        return {
            cacheSize: this.cache.size,
            historySize: (this.searchHistory || []).length,
            cacheStats: [...this.cache.entries()].map(([k, v]) => ({
                key: k,
                age: Date.now() - v.timestamp,
                resultCount: v.data?.results?.length || 0
            }))
        };
    }
}

// Exporta instância singleton
export const searchEngine = new SearchEngine();