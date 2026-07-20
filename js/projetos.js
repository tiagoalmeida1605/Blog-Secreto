/**
 * ==========================================================================
 * Script Público: Exibição dos Projetos (pages/projetos.html)
 * ==========================================================================
 */

const AI_ASSISTANT_PROJECT = {
    id: 'assistente-ia-blog-secreto',
    nome: 'Assistente IA do Blog Secreto',
    descricao: 'Sistema público de chat e busca local com memória de conversa, temas, permissões, modo admin protegido e APIs preparadas.',
    tecnologias: ['JavaScript ES Modules', 'LocalStorage', 'Busca local', 'UI responsiva', 'APIs preparadas'],
    status: 'Público',
    versao: 'v0.1-alpha',
    imagem: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=600&q=80',
    link: '../components/ai-assistant/assistant.html'
};

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('grid-projetos-publicos');

    if (!grid) return;

    bindAssistantPublicActions();

    const projetos = getProjetosPublicos();

    if (projetos.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center;">Nenhum projeto ativo no momento.</p>`;
        return;
    }

    grid.innerHTML = '';

    // Renderiza cada projeto usando as classes do seu pages.css
    projetos.forEach(proj => {
        const article = document.createElement('article');
        article.className = 'project-card';

        const badgesHtml = Array.isArray(proj.tecnologias)
            ? proj.tecnologias.map(tech => `<span class="tech-badge">${escapeHTML(tech)}</span>`).join('')
            : '';

        const btnText = proj.link && proj.link !== '#' ? 'Acessar Projeto' : 'Ver Repositório';
        const imageUrl = safeUrl(proj.imagem, 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80');
        const projectUrl = safeUrl(proj.link || '#', '#');

        article.innerHTML = `
            <img src="${imageUrl}" alt="${escapeHTML(proj.nome)}" class="project-image" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80'">
            
            <div class="project-meta">
                <span>Status: ${escapeHTML(proj.status)}</span>
                <span>${escapeHTML(proj.versao)}</span>
            </div>
            
            <h3 class="project-title">${escapeHTML(proj.nome)}</h3>
            <p class="project-desc">${escapeHTML(proj.descricao)}</p>
            
            <div class="project-tech">
                ${badgesHtml}
            </div>
            
            <button><a href="${projectUrl}" target="_blank" rel="noopener noreferrer">${btnText}</a></button>
        `;

        grid.appendChild(article);
    });
});

function getProjetosPublicos() {
    const dadosLocais = localStorage.getItem('secreto_admin_projetos');

    if (!dadosLocais) {
        return ensureAssistantProject([
            AI_ASSISTANT_PROJECT,
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
        ]);
    }

    try {
        const projetos = JSON.parse(dadosLocais);
        return ensureAssistantProject(Array.isArray(projetos) ? projetos : []);
    } catch (error) {
        return ensureAssistantProject([]);
    }
}

function ensureAssistantProject(projetos) {
    const hasAssistant = projetos.some((proj) => String(proj.id) === AI_ASSISTANT_PROJECT.id ||
        normalizeProjectName(proj.nome) === normalizeProjectName(AI_ASSISTANT_PROJECT.nome));

    return hasAssistant ? projetos : [AI_ASSISTANT_PROJECT, ...projetos];
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
        });
    });
}

function escapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeUrl(url, fallback) {
    const value = String(url || '').trim();
    if (!value || /^(javascript|vbscript|data):/i.test(value)) return fallback;
    if (value === '#' || value.startsWith('./') || value.startsWith('../') || value.startsWith('/')) return value;

    try {
        const parsed = new URL(value, window.location.href);
        return ['http:', 'https:', 'mailto:'].includes(parsed.protocol)
            ? value
            : fallback;
    } catch (error) {
        return fallback;
    }
}

function normalizeProjectName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
