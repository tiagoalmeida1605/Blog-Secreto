import { SecurityManager } from '../core/SecurityManager.js';

export const DEFAULT_PROJECTS = [
    {
        id: 1,
        nome: 'Sistema Nexus',
        descricao: 'Painel de controle focado em privacidade e monitoramento de anomalias em redes locais.',
        tecnologias: ['JavaScript', 'Node.js', 'WebSockets'],
        status: 'Ativo',
        versao: 'v1.2.0',
        imagem: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
        link: '#'
    },
    {
        id: 2,
        nome: 'Cryptos API',
        descricao: 'API para criptografia end-to-end e troca segura de chaves públicas.',
        tecnologias: ['Python', 'FastAPI', 'Docker'],
        status: 'Em Teste',
        versao: 'v0.8.5-beta',
        imagem: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
        link: '#'
    },
    {
        id: 3,
        nome: 'Dossiê Scraper',
        descricao: 'Automação de extração de dados públicos (OSINT) e relatórios.',
        tecnologias: ['Python', 'Selenium'],
        status: 'Arquivado',
        versao: 'v2.0.1',
        imagem: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
        link: '#'
    }
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
            session: `${namespace}_session`
        };

        this.ensureSession();
        this.seedLogs();
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

    getLastResults() {
        return this.read(this.keys.memory, { lastResults: [] }).lastResults || [];
    }

    getLastIntent() {
        return this.read(this.keys.memory, { lastIntent: null }).lastIntent || null;
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

        const saved = SecurityManager.safeJsonParse(localStorage.getItem('secreto_admin_projetos'), null);
        return Array.isArray(saved) && saved.length ? saved : DEFAULT_PROJECTS;
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
