/**
 * ==========================================================================
 * Script Público: Exibição dos Projetos (pages/projetos.html)
 * ==========================================================================
 */

(function initProjetosPublicos() {
    if (window.__ProjetosPublicosLoaded) return;
    window.__ProjetosPublicosLoaded = true;

    const PROJECTS_STORAGE_KEY = 'secreto_admin_projetos';
    const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80';
    const LEGACY_SAMPLE_PROJECTS = [
        ['1', 'Sistema Nexus', 'Painel de controle focado em privacidade e monitoramento de anomalias em redes locais.'],
        ['2', 'Cryptos API', 'API para criptografia end-to-end e troca segura de chaves públicas.'],
        ['3', 'Dossiê Scraper', 'Automação de extração de dados públicos (OSINT) e relatórios.']
    ];

    function init() {
        const grid = document.getElementById('grid-projetos-publicos');
        if (!grid) return;

        bindAssistantPublicActions();
        renderProjetos(grid, getProjetosPublicos());
    }

    function renderProjetos(grid, projetos) {
        if (!projetos.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Nenhum projeto ativo no momento.';
            empty.style.cssText = 'color: var(--text-secondary); grid-column: 1 / -1; text-align: center;';
            grid.replaceChildren(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        projetos.forEach((projeto) => fragment.appendChild(createProjectCard(projeto)));
        grid.replaceChildren(fragment);
    }

    function createProjectCard(projeto) {
        const article = document.createElement('article');
        const image = document.createElement('img');
        const meta = document.createElement('div');
        const status = document.createElement('span');
        const version = document.createElement('span');
        const title = document.createElement('h3');
        const description = document.createElement('p');
        const techList = document.createElement('div');
        const button = document.createElement('button');
        const link = document.createElement('a');
        const projectUrl = safeUrl(projeto.link || '#', '#', { allowMailto: true });

        article.className = 'project-card';

        image.src = safeUrl(projeto.imagem, FALLBACK_IMAGE);
        image.alt = projeto.nome;
        image.className = 'project-image';
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            image.src = FALLBACK_IMAGE;
        }, { once: true });

        meta.className = 'project-meta';
        status.textContent = `Status: ${projeto.status}`;
        version.textContent = projeto.versao;
        meta.append(status, version);

        title.className = 'project-title';
        title.textContent = projeto.nome;

        description.className = 'project-desc';
        description.textContent = projeto.descricao;

        techList.className = 'project-tech';
        projeto.tecnologias.forEach((tecnologia) => {
            const badge = document.createElement('span');
            badge.className = 'tech-badge';
            badge.textContent = tecnologia;
            techList.appendChild(badge);
        });

        link.href = projectUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = projectUrl !== '#' ? 'Acessar Projeto' : 'Ver Repositório';

        button.type = 'button';
        button.appendChild(link);

        article.append(image, meta, title, description, techList, button);
        return article;
    }

    function getProjetosPublicos() {
        const projetos = parseProjetos(localStorage.getItem(PROJECTS_STORAGE_KEY));
        return normalizeProjetos(projetos, { removeLegacySamples: true });
    }

    function parseProjetos(rawValue) {
        try {
            const parsed = rawValue ? JSON.parse(rawValue) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function normalizeProjetos(projetos, options = {}) {
        const uniqueIds = new Set();
        const uniqueFingerprints = new Set();
        const normalized = [];

        projetos.forEach((rawProjeto) => {
            const projeto = normalizeProjeto(rawProjeto);
            if (!projeto.nome) return;
            if (options.removeLegacySamples && isLegacySample(projeto)) return;
            if (uniqueIds.has(projeto.id)) return;

            const fingerprint = createFingerprint(projeto);
            if (uniqueFingerprints.has(fingerprint)) return;

            uniqueIds.add(projeto.id);
            uniqueFingerprints.add(fingerprint);
            normalized.push(projeto);
        });

        return normalized;
    }

    function normalizeProjeto(projeto = {}) {
        const normalized = {
            id: String(projeto.id || '').trim(),
            nome: sanitizeText(projeto.nome),
            descricao: sanitizeText(projeto.descricao),
            tecnologias: normalizeTechnologies(projeto.tecnologias),
            status: sanitizeText(projeto.status) || 'Ativo',
            versao: sanitizeText(projeto.versao),
            imagem: safeUrl(projeto.imagem, ''),
            link: safeUrl(projeto.link, '#', { allowMailto: true })
        };

        if (!normalized.id) {
            normalized.id = createFingerprint(normalized);
        }

        return normalized;
    }

    function normalizeTechnologies(value) {
        const technologies = Array.isArray(value)
            ? value
            : String(value || '').split(',');
        const unique = new Set();

        technologies
            .map((technology) => sanitizeText(technology))
            .filter(Boolean)
            .forEach((technology) => unique.add(technology));

        return [...unique];
    }

    function bindAssistantPublicActions() {
        document.querySelectorAll('[data-open-ai-assistant]').forEach((button) => {
            button.addEventListener('click', () => {
                const assistant = window.__BlogSecretoAssistant;

                if (assistant && assistant.ui && typeof assistant.ui.open === 'function') {
                    assistant.ui.open();
                    return;
                }

                document.querySelector('.ai-launcher')?.click();
            }, { once: false });
        });
    }

    function sanitizeText(value) {
        return String(value || '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .trim();
    }

    function safeUrl(url, fallback = '#', options = {}) {
        const value = String(url || '').trim();
        if (!value || value === '#') return fallback;
        if (/^(javascript|vbscript|data):/i.test(value)) return fallback;
        if (value.startsWith('//')) return fallback;
        if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/') || value.startsWith('#')) return value;

        try {
            const parsed = new URL(value, window.location.href);
            const allowedProtocols = options.allowMailto
                ? ['http:', 'https:', 'mailto:']
                : ['http:', 'https:'];

            return allowedProtocols.includes(parsed.protocol) ? parsed.href : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function isLegacySample(projeto) {
        const id = String(projeto.id || '').trim();
        const name = normalizeForCompare(projeto.nome);
        const description = normalizeForCompare(projeto.descricao);

        return LEGACY_SAMPLE_PROJECTS.some(([sampleId, sampleName, sampleDescription]) => (
            id === sampleId &&
            name === normalizeForCompare(sampleName) &&
            description === normalizeForCompare(sampleDescription)
        ));
    }

    function createFingerprint(projeto) {
        return [
            normalizeForCompare(projeto.nome),
            normalizeForCompare(projeto.descricao),
            normalizeForCompare(projeto.versao)
        ].join('|');
    }

    function normalizeForCompare(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
