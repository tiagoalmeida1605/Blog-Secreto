/**
 * actions.js - Ações rápidas contextuais
 *
 * Responsabilidades:
 * - Gerar botões de ação dinâmicos baseados no intent e dados
 * - Definir tipos de ação padrão (navegar, buscar, admin, etc.)
 * - Validação e sanitização de ações
 * - Ícones e variantes visuais (primary, secondary, ghost)
 * - Handlers de execução de ações
 */

import { SecurityManager } from '../core/SecurityManager.js';
import { ENTITY_TYPES } from './memory.js';

/**
 * Tipos de ação suportados
 */
export const ACTION_TYPES = Object.freeze({
    NAVIGATE: 'navigate',
    SEARCH: 'search',
    ADMIN_NEW_PROJECT: 'admin_new_project',
    ADMIN_NEW_POST: 'admin_new_post',
    ADMIN_EDIT_GALLERY: 'admin_edit_gallery',
    OPEN_DEV_DASHBOARD: 'open_dev_dashboard',
    OPEN_LOGS: 'open_logs',
    OPEN_GITHUB: 'open_github',
    OPEN_SETTINGS: 'open_settings',
    SHARE: 'share',
    COPY: 'copy',
    RELATED: 'related',
    DEEP_DIVE: 'deep_dive'
});

/**
 * Variantes visuais dos botões
 */
export const ACTION_VARIANTS = Object.freeze({
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
    GHOST: 'ghost'
});

/**
 * Ícones por tipo de ação
 */
export const ACTION_ICONS = Object.freeze({
    [ACTION_TYPES.NAVIGATE]: '🔗',
    [ACTION_TYPES.SEARCH]: '🔍',
    [ACTION_TYPES.ADMIN_NEW_PROJECT]: '➕',
    [ACTION_TYPES.ADMIN_NEW_POST]: '📝',
    [ACTION_TYPES.ADMIN_EDIT_GALLERY]: '🖼️',
    [ACTION_TYPES.OPEN_DEV_DASHBOARD]: '⚙️',
    [ACTION_TYPES.OPEN_LOGS]: '📋',
    [ACTION_TYPES.OPEN_GITHUB]: '🐙',
    [ACTION_TYPES.OPEN_SETTINGS]: '⚙️',
    [ACTION_TYPES.SHARE]: '📤',
    [ACTION_TYPES.COPY]: '📋',
    [ACTION_TYPES.RELATED]: '🔄',
    [ACTION_TYPES.DEEP_DIVE]: '🔬'
});

/**
 * Rótulos padrão por tipo
 */
export const ACTION_LABELS = Object.freeze({
    [ACTION_TYPES.NAVIGATE]: 'Abrir',
    [ACTION_TYPES.SEARCH]: 'Buscar',
    [ACTION_TYPES.ADMIN_NEW_PROJECT]: 'Novo Projeto',
    [ACTION_TYPES.ADMIN_NEW_POST]: 'Novo Post',
    [ACTION_TYPES.ADMIN_EDIT_GALLERY]: 'Editar Galeria',
    [ACTION_TYPES.OPEN_DEV_DASHBOARD]: 'Dev Dashboard',
    [ACTION_TYPES.OPEN_LOGS]: 'Ver Logs',
    [ACTION_TYPES.OPEN_GITHUB]: 'GitHub',
    [ACTION_TYPES.OPEN_SETTINGS]: 'Configurações',
    [ACTION_TYPES.SHARE]: 'Compartilhar',
    [ACTION_TYPES.COPY]: 'Copiar',
    [ACTION_TYPES.RELATED]: 'Relacionados',
    [ACTION_TYPES.DEEP_DIVE]: 'Aprofundar'
});

/**
 * ActionManager - Gerenciador de ações contextuais
 */
export class ActionManager {
    constructor(options = {}) {
        this.security = options.security || new SecurityManager();
        this.customActions = new Map(); // actionType -> handler
        this.actionHooks = {
            beforeExecute: [],
            afterExecute: []
        };
    }

    /**
     * Registra handler customizado para tipo de ação
     */
    registerActionHandler(actionType, handler) {
        this.customActions.set(actionType, handler);
    }

    /**
     * Registra hook de execução
     */
    onBeforeExecute(callback) {
        this.actionHooks.beforeExecute.push(callback);
    }

    onAfterExecute(callback) {
        this.actionHooks.afterExecute.push(callback);
    }

    /**
     * Gera ações para intent de listagem de projetos
     */
    generateProjectActions(projects, context = {}) {
        const actions = [];
        const { isAdmin, maxActions = 6 } = context;

        if (!projects?.length) return actions;

        projects.slice(0, Math.ceil(maxActions / 2)).forEach(project => {
            // Ação principal: abrir projeto
            if (project.link && project.link !== '#') {
                actions.push(this.createAction({
                    type: ACTION_TYPES.NAVIGATE,
                    label: `Abrir ${this.security.sanitize(project.nome || project.title || 'Projeto')}`,
                    href: project.link,
                    variant: ACTION_VARIANTS.PRIMARY,
                    payload: { projectId: project.id, source: 'project_list' }
                }));
            }

            // Ação secundária: ver tecnologias
            if (project.tecnologias?.length) {
                actions.push(this.createAction({
                    type: ACTION_TYPES.SEARCH,
                    label: `🛠 Tec de ${this.security.sanitize(project.nome || project.title || 'Projeto')}`,
                    variant: ACTION_VARIANTS.SECONDARY,
                    payload: {
                        query: `tecnologias do ${project.nome || project.title}`,
                        context: { projectId: project.id }
                    }
                }));
            }

            // Ação relacionada: projetos similares
            if (project.tags?.length || project.categoria) {
                actions.push(this.createAction({
                    type: ACTION_TYPES.RELATED,
                    label: `🔄 Similares a ${this.security.sanitize(project.nome || project.title || 'Projeto')}`,
                    variant: ACTION_VARIANTS.GHOST,
                    payload: {
                        query: `projetos parecidos com ${project.nome || project.title}`,
                        context: { projectId: project.id, tags: project.tags, categoria: project.categoria }
                    }
                }));
            }
        });

        // Ação genérica se tem poucos projetos
        if (actions.length < maxActions) {
            actions.push(this.createAction({
                type: ACTION_TYPES.SEARCH,
                label: '🔍 Buscar outros projetos',
                variant: ACTION_VARIANTS.SECONDARY,
                payload: { query: 'projetos' }
            }));
        }

        return actions.slice(0, maxActions);
    }

    /**
     * Gera ações para detalhes de projeto
     */
    generateProjectDetailActions(project, context = {}) {
        const actions = [];
        if (!project) return actions;

        const name = this.security.sanitize(project.nome || project.title || 'Projeto');

        // Abrir projeto
        if (project.link && project.link !== '#') {
            actions.push(this.createAction({
                type: ACTION_TYPES.NAVIGATE,
                label: `🔗 Abrir ${name}`,
                href: project.link,
                variant: ACTION_VARIANTS.PRIMARY,
                payload: { projectId: project.id }
            }));
        }

        // Ver tecnologias
        if (project.tecnologias?.length) {
            actions.push(this.createAction({
                type: ACTION_TYPES.SEARCH,
                label: `🛠 Tecnologias do ${name}`,
                variant: ACTION_VARIANTS.SECONDARY,
                payload: { query: `tecnologias do ${name}`, context: { projectId: project.id } }
            }));
        }

        // Projetos relacionados
        actions.push(this.createAction({
            type: ACTION_TYPES.RELATED,
            label: `🔄 Projetos relacionados`,
            variant: ACTION_VARIANTS.GHOST,
            payload: {
                query: `projetos relacionados a ${name}`,
                context: { projectId: project.id, tags: project.tecnologias, categoria: project.categoria }
            }
        }));

        // Aprofundar (busca mais detalhada)
        if (project.categoria) {
            actions.push(this.createAction({
                type: ACTION_TYPES.DEEP_DIVE,
                label: `🔬 Mais ${this.security.sanitize(project.categoria)}`,
                variant: ACTION_VARIANTS.GHOST,
                payload: { query: `projetos de ${project.categoria}`, context: { categoria: project.categoria } }
            }));
        }

        return actions.slice(0, 6);
    }

    /**
     * Gera ações para listagem de posts
     */
    generatePostActions(posts, context = {}) {
        const actions = [];
        const { maxActions = 6 } = context;

        if (!posts?.length) return actions;

        posts.slice(0, Math.min(3, maxActions)).forEach(post => {
            const title = this.security.sanitize(post.titulo || post.title || 'Post');
            const href = post.link || `/post/${post.slug || post.id}`;

            actions.push(this.createAction({
                type: ACTION_TYPES.NAVIGATE,
                label: `📖 Ler "${title}"`,
                href,
                variant: ACTION_VARIANTS.PRIMARY,
                payload: { postId: post.id }
            }));

            // Tags do post
            if (post.tags?.length) {
                const firstTag = this.security.sanitize(post.tags[0]);
                actions.push(this.createAction({
                    type: ACTION_TYPES.SEARCH,
                    label: `🏷️ Mais sobre ${firstTag}`,
                    variant: ACTION_VARIANTS.GHOST,
                    payload: { query: `posts com tag ${firstTag}`, context: { tag: firstTag } }
                }));
            }
        });

        if (actions.length < maxActions) {
            actions.push(this.createAction({
                type: ACTION_TYPES.SEARCH,
                label: '📝 Ver todos os posts',
                variant: ACTION_VARIANTS.SECONDARY,
                payload: { query: 'posts recentes' }
            }));
        }

        return actions.slice(0, maxActions);
    }

    /**
     * Gera ações para tags
     */
    generateTagActions(tags, context = {}) {
        const actions = [];
        const { maxActions = 6 } = context;

        if (!tags?.length) return actions;

        tags.slice(0, maxActions).forEach(tag => {
            const name = this.security.sanitize(tag.nome || tag.name || tag.slug || 'Tag');
            const slug = tag.slug || name.toLowerCase().replace(/\s+/g, '-');

            actions.push(this.createAction({
                type: ACTION_TYPES.SEARCH,
                label: `🏷️ ${name} (${tag.count || 0})`,
                variant: ACTION_VARIANTS.SECONDARY,
                payload: { query: `tag:${name}`, context: { tag: name, slug } }
            }));
        });

        return actions;
    }

    /**
     * Gera ações para categorias
     */
    generateCategoryActions(categories, context = {}) {
        const actions = [];
        const { maxActions = 6 } = context;

        if (!categories?.length) return actions;

        categories.slice(0, maxActions).forEach(cat => {
            const name = this.security.sanitize(cat.nome || cat.name || 'Categoria');
            const slug = cat.slug || name.toLowerCase().replace(/\s+/g, '-');

            actions.push(this.createAction({
                type: ACTION_TYPES.SEARCH,
                label: `📂 ${name} (${cat.count || 0})`,
                variant: ACTION_VARIANTS.SECONDARY,
                payload: { query: `categoria:${name}`, context: { categoria: name, slug } }
            }));
        });

        return actions;
    }

    /**
     * Gera ações para busca genérica
     */
    generateSearchActions(results, originalQuery, context = {}) {
        const actions = [];
        const { maxActions = 6 } = context;

        if (!results?.length) {
            // Sem resultados - sugere buscas alternativas
            return this.generateEmptySearchActions(originalQuery);
        }

        // Agrupa por tipo
        const byType = {};
        results.forEach(r => {
            const type = r.type || r.source || 'content';
            if (!byType[type]) byType[type] = [];
            byType[type].push(r);
        });

        // Adiciona ação para cada tipo encontrado
        const typeOrder = ['project', 'post', 'tag', 'category', 'faq', 'gallery'];
        typeOrder.forEach(type => {
            if (byType[type]?.length && actions.length < maxActions) {
                const label = this._getTypeLabel(type, true);
                actions.push(this.createAction({
                    type: ACTION_TYPES.SEARCH,
                    label: `🔍 Ver todos ${label}`,
                    variant: ACTION_VARIANTS.SECONDARY,
                    payload: { query: `tipo:${type}`, context: { filterType: type } }
                }));
            }
        });

        // Buscas relacionadas baseadas na query original
        const suggestions = this._generateRelatedSearches(originalQuery, results);
        suggestions.slice(0, maxActions - actions.length).forEach(s => {
            actions.push(this.createAction({
                type: ACTION_TYPES.SEARCH,
                label: s.label,
                variant: ACTION_VARIANTS.GHOST,
                payload: { query: s.query }
            }));
        });

        return actions.slice(0, maxActions);
    }

    /**
     * Gera ações quando busca retorna vazio
     */
    generateEmptySearchActions(query) {
        const actions = [];
        const suggestions = this._getEmptySearchSuggestions(query);

        suggestions.forEach(s => {
            actions.push(this.createAction({
                type: ACTION_TYPES.SEARCH,
                label: s.label,
                variant: ACTION_VARIANTS.SECONDARY,
                payload: { query: s.query }
            }));
        });

        return actions.slice(0, 6);
    }

    /**
     * Gera ações para admin
     */
    generateAdminActions(context = {}) {
        const actions = [];
        const { isAdmin } = context;

        if (!isAdmin) return actions;

        const adminActions = [
            { type: ACTION_TYPES.ADMIN_NEW_PROJECT, label: '➕ Novo Projeto', variant: ACTION_VARIANTS.PRIMARY },
            { type: ACTION_TYPES.ADMIN_NEW_POST, label: '📝 Novo Post', variant: ACTION_VARIANTS.PRIMARY },
            { type: ACTION_TYPES.OPEN_DEV_DASHBOARD, label: '⚙️ Dev Dashboard', variant: ACTION_VARIANTS.SECONDARY },
            { type: ACTION_TYPES.OPEN_LOGS, label: '📋 Ver Logs', variant: ACTION_VARIANTS.SECONDARY },
            { type: ACTION_TYPES.OPEN_GITHUB, label: '🐙 GitHub Status', variant: ACTION_VARIANTS.GHOST },
            { type: ACTION_TYPES.OPEN_SETTINGS, label: '⚙️ Configurações', variant: ACTION_VARIANTS.GHOST }
        ];

        adminActions.forEach(a => {
            actions.push(this.createAction({
                type: a.type,
                label: a.label,
                variant: a.variant,
                payload: {}
            }));
        });

        return actions;
    }

    /**
     * Gera ações para FAQ
     */
    generateFAQActions(faqItems, context = {}) {
        const actions = [];
        const { maxActions = 6 } = context;

        if (!faqItems?.length) return actions;

        faqItems.slice(0, maxActions).forEach(item => {
            actions.push(this.createAction({
                type: ACTION_TYPES.NAVIGATE,
                label: `❓ ${this.security.sanitize(item.pergunta || item.title || 'Pergunta')}`,
                href: `#faq-${item.id}`,
                variant: ACTION_VARIANTS.SECONDARY,
                payload: { faqId: item.id }
            }));
        });

        return actions;
    }

    /**
     * Cria ação padronizada
     */
    createAction(config) {
        const {
            type,
            label,
            href,
            variant = ACTION_VARIANTS.SECONDARY,
            payload = {},
            icon,
            disabled = false,
            requiresAdmin = false,
            confirmation = false
        } = config;

        // Validações
        if (!type || !ACTION_TYPES[type]) {
            throw new Error(`Tipo de ação inválido: ${type}`);
        }

        if (!label) {
            throw new Error('Label é obrigatório para ações');
        }

        if (type === ACTION_TYPES.NAVIGATE && (!href || href === '#')) {
            console.warn('[ActionManager] Ação navigate sem href válido:', config);
        }

        return {
            type: this.security.sanitize(type),
            label: this.security.sanitize(label),
            href: href ? this.security.safeUrl(href) : '#',
            variant: this._validateVariant(variant),
            payload: this._sanitizePayload(payload),
            icon: icon || ACTION_ICONS[type] || '',
            disabled: Boolean(disabled),
            requiresAdmin: Boolean(requiresAdmin),
            confirmation: Boolean(confirmation),
            id: this.security.createId('action'),
            timestamp: Date.now()
        };
    }

    /**
     * Executa ação
     */
    async executeAction(action, context = {}) {
        // Hooks before
        for (const hook of this.actionHooks.beforeExecute) {
            await hook(action, context);
        }

        let result = { success: false };

        try {
            // Handler customizado
            if (this.customActions.has(action.type)) {
                const handler = this.customActions.get(action.type);
                result = await handler(action, context);
            } else {
                // Handler padrão
                result = await this._defaultHandler(action, context);
            }
        } catch (error) {
            console.error('[ActionManager] Erro ao executar ação:', error);
            result = { success: false, error: error.message };
        }

        // Hooks after
        for (const hook of this.actionHooks.afterExecute) {
            await hook(action, result, context);
        }

        return result;
    }

    /**
     * Handler padrão por tipo
     */
    async _defaultHandler(action, context) {
        const { navigate, dispatch, router } = context;

        switch (action.type) {
            case ACTION_TYPES.NAVIGATE:
                if (action.href && action.href !== '#') {
                    if (navigate) {
                        navigate(action.href);
                    } else if (router) {
                        router.navigate(action.href);
                    } else {
                        window.location.href = action.href;
                    }
                    return { success: true, navigated: true };
                }
                return { success: false, error: 'Href inválido' };

            case ACTION_TYPES.SEARCH:
                if (dispatch) {
                    dispatch({ type: 'SEARCH', payload: action.payload });
                } else if (window.assistant) {
                    window.assistant.search(action.payload.query);
                }
                return { success: true, searched: true };

            case ACTION_TYPES.ADMIN_NEW_PROJECT:
            case ACTION_TYPES.ADMIN_NEW_POST:
            case ACTION_TYPES.OPEN_DEV_DASHBOARD:
            case ACTION_TYPES.OPEN_LOGS:
            case ACTION_TYPES.OPEN_GITHUB:
            case ACTION_TYPES.OPEN_SETTINGS:
                if (dispatch) {
                    dispatch({ type: 'ADMIN_ACTION', payload: { action: action.type, ...action.payload } });
                }
                return { success: true, adminAction: true };

            case ACTION_TYPES.SHARE:
                if (navigator.share) {
                    await navigator.share(action.payload);
                    return { success: true, shared: true };
                }
                return { success: false, error: 'Share API não disponível' };

            case ACTION_TYPES.COPY:
                if (action.payload?.text) {
                    await navigator.clipboard.writeText(action.payload.text);
                    return { success: true, copied: true };
                }
                return { success: false, error: 'Nada para copiar' };

            case ACTION_TYPES.RELATED:
            case ACTION_TYPES.DEEP_DIVE:
                if (dispatch) {
                    dispatch({ type: 'SEARCH', payload: action.payload });
                }
                return { success: true, searched: true };

            default:
                return { success: false, error: `Handler não implementado: ${action.type}` };
        }
    }

    /**
     * Valida variante
     */
    _validateVariant(variant) {
        return Object.values(ACTION_VARIANTS).includes(variant) ? variant : ACTION_VARIANTS.SECONDARY;
    }

    /**
     * Sanitiza payload
     */
    _sanitizePayload(payload) {
        if (!payload || typeof payload !== 'object') return {};
        const sanitized = {};
        for (const [key, value] of Object.entries(payload)) {
            if (typeof value === 'string') {
                sanitized[key] = this.security.sanitize(value);
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(v => typeof v === 'string' ? this.security.sanitize(v) : v);
            } else if (value && typeof value === 'object') {
                sanitized[key] = this._sanitizePayload(value);
            }
        }
        return sanitized;
    }

    /**
     * Gera rótulo de tipo para UI
     */
    _getTypeLabel(type, plural = false) {
        const labels = {
            project: plural ? 'Projetos' : 'Projeto',
            post: plural ? 'Posts' : 'Post',
            tag: plural ? 'Tags' : 'Tag',
            category: plural ? 'Categorias' : 'Categoria',
            faq: plural ? 'Perguntas Frequentes' : 'FAQ',
            gallery: plural ? 'Imagens da Galeria' : 'Galeria',
            changelog: plural ? 'Changelog' : 'Novidade',
            content: plural ? 'Conteúdos' : 'Conteúdo'
        };
        return labels[type] || (plural ? 'Itens' : 'Item');
    }

    /**
     * Gera buscas relacionadas
     */
    _generateRelatedSearches(query, results) {
        const suggestions = [];
        const normalizedQuery = query.toLowerCase();

        // Extrai tecnologias mencionadas nos resultados
        const techs = new Set();
        results.forEach(r => {
            (r.tecnologias || r.tags || []).forEach(t => techs.add(t.toLowerCase()));
        });

        // Sugere busca por tecnologia
        [...techs].slice(0, 3).forEach(tech => {
            if (!normalizedQuery.includes(tech)) {
                suggestions.push({
                    label: `🔧 Projetos com ${tech}`,
                    query: `projetos com ${tech}`
                });
            }
        });

        // Sugere categoria
        const categories = new Set();
        results.forEach(r => { if (r.categoria) categories.add(r.categoria.toLowerCase()); });
        [...categories].slice(0, 2).forEach(cat => {
            suggestions.push({
                label: `📂 Mais ${cat}`,
                query: `categoria:${cat}`
            });
        });

        // Buscas genéricas úteis
        if (!normalizedQuery.includes('recente')) {
            suggestions.push({ label: '🆕 Mais recentes', query: 'mais recentes' });
        }
        if (!normalizedQuery.includes('popular')) {
            suggestions.push({ label: '⭐ Mais populares', query: 'mais populares' });
        }

        return suggestions;
    }

    /**
     * Sugestões para busca vazia
     */
    _getEmptySearchSuggestions(query) {
        const suggestions = [
            { label: '🔍 Projetos', query: 'projetos' },
            { label: '📝 Posts recentes', query: 'posts recentes' },
            { label: '🏷️ Tags populares', query: 'tags populares' },
            { label: '📂 Categorias', query: 'categorias' },
            { label: '❓ FAQ', query: 'faq' },
            { label: '🖼️ Galeria', query: 'galeria' }
        ];

        // Personaliza baseado na query original
        const normalized = query.toLowerCase();
        if (normalized.includes('projet') || normalized.includes('project')) {
            suggestions.unshift({ label: '🔍 Todos os projetos', query: 'todos projetos' });
        }
        if (normalized.includes('post') || normalized.includes('artigo')) {
            suggestions.unshift({ label: '📝 Todos os posts', query: 'todos posts' });
        }

        return suggestions;
    }
}

// Instância singleton
export const actionManager = new ActionManager();

// Disponibiliza globalmente para debug
if (typeof window !== 'undefined') {
    window.__ActionManager = actionManager;
}