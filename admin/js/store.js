/**
 * ==========================================================================
 * Store - Camada de Dados Local (LocalStorage / Simulação de Banco)
 * ==========================================================================
 */

const Store = {
    KEYS: {
        PROJETOS: 'secreto_admin_projetos',
        CONFIG: 'secreto_admin_config'
    },

    LEGACY_SAMPLE_PROJECTS: [
        {
            id: '1',
            nome: 'Sistema Nexus',
            descricao: 'Painel de controle focado em privacidade e monitoramento de anomalias em redes locais.'
        },
        {
            id: '2',
            nome: 'Cryptos API',
            descricao: 'API para criptografia end-to-end e troca segura de chaves públicas.'
        },
        {
            id: '3',
            nome: 'Dossiê Scraper',
            descricao: 'Automação de extração de dados públicos (OSINT) e relatórios.'
        }
    ],

    init: function() {
        const saved = this.readRawProjetos();

        // Primeira execução: semear projetos padrão
        if (saved === null) {
            const defaultProjects = this.LEGACY_SAMPLE_PROJECTS.map((sample) => ({
                id: sample.id,
                nome: sample.nome,
                descricao: sample.descricao,
                tecnologias: ['Python', 'JavaScript'],
                status: 'Ativo',
                versao: '1.0.0',
                imagem: '',
                link: '#'
            }));
            this.saveProjetos(defaultProjects);
            return;
        }

        const parsed = this.parseProjetos(saved);
        const normalized = this.normalizeProjetos(parsed);
        const normalizedSerialized = JSON.stringify(normalized);

        if (saved !== normalizedSerialized) {
            this.saveProjetos(normalized);
        }
    },

    getProjetos: function() {
        const saved = this.readRawProjetos();

        if (saved === null) {
            this.saveProjetos([]);
            return [];
        }

        const parsed = this.parseProjetos(saved);
        const normalized = this.normalizeProjetos(parsed);
        const normalizedSerialized = JSON.stringify(normalized);

        if (saved !== normalizedSerialized) {
            this.saveProjetos(normalized);
        }

        return normalized;
    },

    getProjetoById: function(id) {
        const normalizedId = this.normalizeId(id);
        return this.getProjetos().find((projeto) => projeto.id === normalizedId) || null;
    },

    addProjeto: function(projeto) {
        const projetos = this.getProjetos();
        const novoProjeto = this.normalizeProjeto({
            ...projeto,
            id: this.createId()
        });

        projetos.unshift(novoProjeto);
        this.saveProjetos(this.normalizeProjetos(projetos));
        return novoProjeto;
    },

    updateProjeto: function(id, dadosAtualizados) {
        const normalizedId = this.normalizeId(id);
        const projetos = this.getProjetos();
        const index = projetos.findIndex((projeto) => projeto.id === normalizedId);

        if (index === -1) return null;

        const projetoAtualizado = this.normalizeProjeto({
            ...projetos[index],
            ...dadosAtualizados,
            id: normalizedId
        });

        projetos[index] = projetoAtualizado;
        this.saveProjetos(this.normalizeProjetos(projetos));
        return projetoAtualizado;
    },

    deleteProjeto: function(id) {
        const normalizedId = this.normalizeId(id);
        const projetos = this.getProjetos();
        const filtrados = projetos.filter((projeto) => projeto.id !== normalizedId);

        if (filtrados.length === projetos.length) return false;

        this.saveProjetos(filtrados);
        return true;
    },

    getStats: function() {
        const projetos = this.getProjetos();

        return {
            totalProjetos: projetos.length,
            ativos: projetos.filter((projeto) => this.normalizeForCompare(projeto.status) === 'ativo').length,
            emTeste: projetos.filter((projeto) => this.normalizeForCompare(projeto.status) === 'em teste').length
        };
    },

    readRawProjetos: function() {
        try {
            return localStorage.getItem(this.KEYS.PROJETOS);
        } catch (error) {
            console.warn('[Store] Não foi possível ler os projetos:', error);
            return null;
        }
    },

    parseProjetos: function(rawValue) {
        try {
            const parsed = rawValue ? JSON.parse(rawValue) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('[Store] Projetos corrompidos no LocalStorage. O banco local foi reiniciado.', error);
            return [];
        }
    },

    saveProjetos: function(projetos) {
        const normalized = Array.isArray(projetos) ? projetos : [];

        try {
            localStorage.setItem(this.KEYS.PROJETOS, JSON.stringify(normalized));
            return true;
        } catch (error) {
            console.warn('[Store] Não foi possível salvar os projetos:', error);
            return false;
        }
    },

    normalizeProjetos: function(projetos, options = {}) {
        const uniqueIds = new Set();
        const uniqueFingerprints = new Set();
        const normalized = [];

        (Array.isArray(projetos) ? projetos : []).forEach((rawProjeto) => {
            const projeto = this.normalizeProjeto(rawProjeto);

            if (!projeto.nome) return;
            if (options.removeLegacySamples && this.isLegacySample(projeto)) return;
            if (uniqueIds.has(projeto.id)) return;

            const fingerprint = this.createFingerprint(projeto);
            if (uniqueFingerprints.has(fingerprint)) return;

            uniqueIds.add(projeto.id);
            uniqueFingerprints.add(fingerprint);
            normalized.push(projeto);
        });

        return normalized;
    },

    normalizeProjeto: function(projeto = {}) {
        return {
            id: this.normalizeId(projeto.id || this.createId()),
            nome: this.sanitizeText(projeto.nome),
            descricao: this.sanitizeText(projeto.descricao),
            tecnologias: this.normalizeTechnologies(projeto.tecnologias),
            status: this.sanitizeText(projeto.status) || 'Ativo',
            versao: this.sanitizeText(projeto.versao),
            imagem: this.safeUrl(projeto.imagem, ''),
            link: this.safeUrl(projeto.link, '#', { allowMailto: true })
        };
    },

    normalizeTechnologies: function(value) {
        const tecnologias = Array.isArray(value)
            ? value
            : String(value || '').split(',');

        const unique = new Set();

        tecnologias
            .map((tecnologia) => this.sanitizeText(tecnologia))
            .filter(Boolean)
            .forEach((tecnologia) => unique.add(tecnologia));

        return [...unique];
    },

    normalizeId: function(id) {
        return String(id || '').trim();
    },

    createId: function() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return `proj-${window.crypto.randomUUID()}`;
        }

        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            const values = new Uint32Array(2);
            window.crypto.getRandomValues(values);
            return `proj-${values[0].toString(36)}-${values[1].toString(36)}`;
        }

        const first = Math.random().toString(36).slice(2, 10);
        const second = Math.random().toString(36).slice(2, 10);
        return `proj-${first}-${second}`;
    },

    sanitizeText: function(value) {
        return String(value || '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .trim();
    },

    safeUrl: function(url, fallback = '#', options = {}) {
        const value = String(url || '').trim();
        if (!value || value === '#') return fallback;
        if (/^(javascript|vbscript|data):/i.test(value)) return fallback;
        if (value.startsWith('//')) return fallback;

        if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/') || value.startsWith('#')) {
            return value;
        }

        try {
            const parsed = new URL(value, window.location.href);
            const allowedProtocols = options.allowMailto
                ? ['http:', 'https:', 'mailto:']
                : ['http:', 'https:'];

            return allowedProtocols.includes(parsed.protocol) ? parsed.href : fallback;
        } catch (error) {
            return fallback;
        }
    },

    isLegacySample: function(projeto) {
        const projectName = this.normalizeForCompare(projeto.nome);
        const projectDescription = this.normalizeForCompare(projeto.descricao);

        return this.LEGACY_SAMPLE_PROJECTS.some((sample) => (
            this.normalizeId(projeto.id) === sample.id &&
            projectName === this.normalizeForCompare(sample.nome) &&
            projectDescription === this.normalizeForCompare(sample.descricao)
        ));
    },

    createFingerprint: function(projeto) {
        return [
            this.normalizeForCompare(projeto.nome),
            this.normalizeForCompare(projeto.descricao),
            this.normalizeForCompare(projeto.versao)
        ].join('|');
    },

    normalizeForCompare: function(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }
};

window.Store = Store;
Store.init();
