import { SecurityManager } from '../core/SecurityManager.js';

const PROJECTS_STORAGE_KEY = 'secreto_admin_projetos';
const LEGACY_SAMPLE_PROJECTS = [
    ['1', 'Sistema Nexus', 'Painel de controle focado em privacidade e monitoramento de anomalias em redes locais.'],
    ['2', 'Cryptos API', 'API para criptografia end-to-end e troca segura de chaves públicas.'],
    ['3', 'Dossiê Scraper', 'Automação de extração de dados públicos (OSINT) e relatórios.']
];

export class StorageManager {
    constructor(namespace = 'secreto_ai_assistant') {
        this.namespace = namespace;
        this.keys = {
            conversation: `${namespace}_conversation`,
            memory: `${namespace}_memory`,
            settings: `${namespace}_settings`,
            rateLimit: `${namespace}_rate_limit`,
            logs: `${namespace}_logs`,
            session: `${namespace}_session`,
            visitor: `${namespace}_visitor`,
            context: `${namespace}_context`
        };

        this.ensureSession();
        this.ensureVisitorProfile();
        this.ensureConversationContext();
        this.seedLogs();
    }

    ensureVisitorProfile() {
        if (!this.read(this.keys.visitor, null)) {
            this.write(this.keys.visitor, {
                id: SecurityManager.createId('visitor'),
                name: null,
                themePreference: 'system',
                firstVisit: new Date().toISOString(),
                lastVisit: new Date().toISOString(),
                visitCount: 1,
                knownProjects: [],
                knownPosts: [],
                preferences: {}
            });
        } else {
            // Atualiza contador de visitas e última visita
            const profile = this.read(this.keys.visitor);
            profile.visitCount = (profile.visitCount || 0) + 1;
            profile.lastVisit = new Date().toISOString();
            this.write(this.keys.visitor, profile);
        }
    }

    ensureConversationContext() {
        if (!this.read(this.keys.context, null)) {
            this.write(this.keys.context, {
                currentPage: window.location.pathname,
                lastProject: null,
                lastPost: null,
                lastSearch: null,
                lastIntent: null,
                lastResults: [],
                lastTopics: [],
                navigationHistory: [window.location.pathname]
            });
        }
    }

    ensureSession() {
        if (!this.read(this.keys.session, null)) {
            this.write(this.keys.session, {
                id: SecurityManager.createId('session'),
                startedAt: new Date().toISOString()
            });
        }
    }

    read(key, fallback) {
        try {
            return SecurityManager.safeJsonParse(localStorage.getItem(key), fallback);
        } catch (error) {
            return fallback;
        }
    }

    write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('[Assistente IA] Falha ao gravar no LocalStorage:', error);
            return false;
        }
    }

    getSession() {
        return this.read(this.keys.session, {
            id: 'session-local',
            startedAt: new Date().toISOString()
        });
    }

    getConversation() {
        return this.read(this.keys.conversation, []);
    }

    saveMessage(message) {
        const current = this.getConversation();
        const safeMessage = this.normalizeMessage(message);
        const next = [...current, safeMessage].slice(-80);
        this.write(this.keys.conversation, next);
        return next;
    }

    normalizeMessage(message) {
        return {
            id: message.id || SecurityManager.createId('msg'),
            role: ['user', 'assistant', 'system'].includes(message.role) ? message.role : 'system',
            text: SecurityManager.sanitize(message.text || ''),
            timestamp: message.timestamp || new Date().toISOString(),
            results: Array.isArray(message.results)
                ? message.results.slice(0, 12).map((item) => this.normalizeResult(item))
                : [],
            actions: Array.isArray(message.actions)
                ? message.actions.slice(0, 6).map((action) => ({
                    label: SecurityManager.sanitize(action.label || 'Abrir'),
                    type: SecurityManager.sanitize(action.type || 'navigate'),
                    href: SecurityManager.safeUrl(action.href || '#'),
                    payload: action.payload || {}
                }))
                : [],
            meta: message.meta || {}
        };
    }

    normalizeResult(item) {
        return {
            id: SecurityManager.sanitize(String(item.id || SecurityManager.createId('res'))),
            type: SecurityManager.sanitize(item.type || 'conteudo'),
            title: SecurityManager.sanitize(item.title || item.nome || item.name || 'Sem título'),
            description: SecurityManager.sanitize(item.description || item.descricao || ''),
            href: SecurityManager.safeUrl(item.href || item.path || '#'),
            tags: Array.isArray(item.tags) ? item.tags.map((tag) => SecurityManager.sanitize(tag)) : [],
            score: Number(item.score || 0)
        };
    }

    replaceConversation(messages) {
        const safeMessages = Array.isArray(messages) ? messages.map((message) => this.normalizeMessage(message)) : [];
        this.write(this.keys.conversation, safeMessages.slice(-80));
        return this.getConversation();
    }

    clearConversation() {
        this.write(this.keys.conversation, []);
    }

    startNewConversation() {
        this.clearConversation();
        this.write(this.keys.memory, { lastIntent: null, lastResults: [] });
    }

    clearAll() {
        this.clearConversation();
        this.write(this.keys.visitor, {
            id: SecurityManager.createId('visitor'),
            name: null,
            themePreference: 'system',
            firstVisit: new Date().toISOString(),
            lastVisit: new Date().toISOString(),
            visitCount: 1,
            knownProjects: [],
            knownPosts: [],
            preferences: {}
        });
        this.write(this.keys.context, {
            currentPage: window.location.pathname,
            lastProject: null,
            lastPost: null,
            lastSearch: null,
            lastIntent: null,
            lastResults: [],
            lastTopics: [],
            navigationHistory: [window.location.pathname]
        });
    }

    exportConversation() {
        return JSON.stringify({
            exportedAt: new Date().toISOString(),
            session: this.getSession(),
            messages: this.getConversation()
        }, null, 2);
    }

    getSettings() {
        return {
            theme: 'system',
            provider: 'local',
            ...this.read(this.keys.settings, {})
        };
    }

    saveSettings(nextSettings) {
        const settings = {
            ...this.getSettings(),
            ...nextSettings
        };

        this.write(this.keys.settings, settings);
        return settings;
    }

    saveMemoryState(memoryState) {
        this.write(this.keys.memory, {
            lastIntent: memoryState.lastIntent || null,
            lastResults: Array.isArray(memoryState.lastResults)
                ? memoryState.lastResults.map((item) => this.normalizeResult(item))
                : []
        });
    }

    // ==================== VISITOR PROFILE ====================

    getVisitorProfile() {
        return this.read(this.keys.visitor, {
            id: SecurityManager.createId('visitor'),
            name: null,
            themePreference: 'system',
            firstVisit: new Date().toISOString(),
            lastVisit: new Date().toISOString(),
            visitCount: 1,
            knownProjects: [],
            knownPosts: [],
            preferences: {}
        });
    }

    updateVisitorProfile(updates) {
        const profile = this.getVisitorProfile();
        const updated = { ...profile, ...updates };
        this.write(this.keys.visitor, updated);
        return updated;
    }

    // ==================== CONVERSATION CONTEXT ====================

    getConversationContext() {
        return this.read(this.keys.context, {
            currentPage: window.location.pathname,
            lastProject: null,
            lastPost: null,
            lastSearch: null,
            lastIntent: null,
            lastResults: [],
            lastTopics: [],
            navigationHistory: [window.location.pathname]
        });
    }

    updateConversationContext(updates) {
        const context = this.getConversationContext();
        const updated = { ...context, ...updates };

        // Manter histórico de navegação (máx 10 páginas)
        if (updates.currentPage && updates.currentPage !== context.currentPage) {
            const history = updated.navigationHistory || [];
            if (!history.includes(updates.currentPage)) {
                history.push(updates.currentPage);
                updated.navigationHistory = history.slice(-10);
            }
        }

        this.write(this.keys.context, updated);
        return updated;
    }

    // ==================== MEMORY STATE (legado - compatibilidade) ====================

    getLastResults() {
        const context = this.getConversationContext();
        return context.lastResults || [];
    }

    getLastIntent() {
        const context = this.getConversationContext();
        return context.lastIntent || null;
    }

    getRecentTimestamps(limit = 6, windowMs = 10000) {
        const now = Date.now();
        return this.read(this.keys.rateLimit, [])
            .filter((timestamp) => now - timestamp < windowMs)
            .slice(-limit);
    }

    recordRequestTimestamp() {
        const timestamps = this.getRecentTimestamps(50, 60000);
        timestamps.push(Date.now());
        this.write(this.keys.rateLimit, timestamps);
    }

    getProjects() {
        if (window.Store && typeof window.Store.getProjetos === 'function') {
            return window.Store.getProjetos();
        }

        const saved = SecurityManager.safeJsonParse(localStorage.getItem(PROJECTS_STORAGE_KEY), []);
        return this.normalizeProjects(Array.isArray(saved) ? saved : []);
    }

    normalizeProjects(projects) {
        const uniqueIds = new Set();
        const uniqueFingerprints = new Set();
        const normalized = [];

        projects.forEach((rawProject) => {
            const project = this.normalizeProject(rawProject);
            if (!project.nome) return;
            if (this.isLegacySampleProject(project)) return;
            if (uniqueIds.has(project.id)) return;

            const fingerprint = this.createProjectFingerprint(project);
            if (uniqueFingerprints.has(fingerprint)) return;

            uniqueIds.add(project.id);
            uniqueFingerprints.add(fingerprint);
            normalized.push(project);
        });

        return normalized;
    }

    normalizeProject(project = {}) {
        const normalized = {
            id: String(project.id || '').trim(),
            nome: SecurityManager.sanitize(project.nome || project.title || ''),
            descricao: SecurityManager.sanitize(project.descricao || project.description || ''),
            tecnologias: this.normalizeTechnologies(project.tecnologias || project.tags),
            status: SecurityManager.sanitize(project.status || 'Ativo'),
            versao: SecurityManager.sanitize(project.versao || ''),
            imagem: this.safeProjectUrl(project.imagem || project.image || '', ''),
            link: SecurityManager.safeUrl(project.link || project.href || '#')
        };

        if (!normalized.id) {
            normalized.id = this.createProjectFingerprint(normalized);
        }

        return normalized;
    }

    normalizeTechnologies(value) {
        const technologies = Array.isArray(value)
            ? value
            : String(value || '').split(',');
        const unique = new Set();

        technologies
            .map((technology) => SecurityManager.sanitize(technology))
            .filter(Boolean)
            .forEach((technology) => unique.add(technology));

        return [...unique];
    }

    safeProjectUrl(url, fallback = '#') {
        const value = String(url || '').trim();
        if (!value || value === '#') return fallback;
        if (/^(javascript|vbscript|data):/i.test(value)) return fallback;
        if (value.startsWith('//')) return fallback;
        return SecurityManager.safeUrl(value);
    }

    isLegacySampleProject(project) {
        const id = String(project.id || '').trim();
        const name = SecurityManager.normalizeForSearch(project.nome);
        const description = SecurityManager.normalizeForSearch(project.descricao);

        return LEGACY_SAMPLE_PROJECTS.some(([sampleId, sampleName, sampleDescription]) => (
            id === sampleId &&
            name === SecurityManager.normalizeForSearch(sampleName) &&
            description === SecurityManager.normalizeForSearch(sampleDescription)
        ));
    }

    createProjectFingerprint(project) {
        return [
            SecurityManager.normalizeForSearch(project.nome),
            SecurityManager.normalizeForSearch(project.descricao),
            SecurityManager.normalizeForSearch(project.versao)
        ].join('|');
    }

    getPosts() {
        const saved = SecurityManager.safeJsonParse(localStorage.getItem('secreto_admin_posts'), []);
        return Array.isArray(saved) ? saved : [];
    }

    getChangelog() {
        const saved = SecurityManager.safeJsonParse(localStorage.getItem('secreto_admin_changelog'), []);
        if (Array.isArray(saved) && saved.length) return saved;

        return [
            {
                id: 'changelog-admin-v01',
                title: 'Admin Secreto v0.1-alpha',
                description: 'Dashboard, login simulado, CRUD local de projetos e base para futuras integrações.',
                date: '2026-07-20',
                tags: ['admin', 'localStorage', 'projetos']
            },
            {
                id: 'changelog-ai-assistant',
                title: 'Assistente IA',
                description: 'Camada local de busca, memória de conversa, permissões público/admin e provedores de IA preparados.',
                date: '2026-07-20',
                tags: ['assistente', 'busca', 'ia']
            }
        ];
    }

    getLogs() {
        return this.read(this.keys.logs, []);
    }

    addLog(entry) {
        const logs = this.getLogs();
        logs.unshift({
            id: SecurityManager.createId('log'),
            date: new Date().toISOString(),
            category: entry.category || 'INFO',
            user: entry.user || 'local',
            message: SecurityManager.sanitize(entry.message || ''),
            query: SecurityManager.sanitize(entry.query || '')
        });

        this.write(this.keys.logs, logs.slice(0, 120));
    }

    seedLogs() {
        const logs = this.getLogs();
        if (logs.length) return;

        this.write(this.keys.logs, [
            {
                id: 'log-ai-ready',
                date: new Date().toISOString(),
                category: 'INFO',
                user: 'system',
                message: 'Assistente IA inicializado em modo local.',
                query: ''
            },
            {
                id: 'log-security-local',
                date: new Date().toISOString(),
                category: 'SECURITY',
                user: 'system',
                message: 'Permissões administrativas dependem de sessão autenticada no painel.',
                query: ''
            }
        ]);
    }

    getLocalStorageSize() {
        try {
            let total = 0;
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                total += key.length + String(localStorage.getItem(key)).length;
            }

            return total * 2;
        } catch (error) {
            return 0;
        }
    }
}
