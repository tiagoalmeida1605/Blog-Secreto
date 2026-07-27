/**
 * ==========================================================================
 * Script Público: Exibição dos Projetos (pages/projetos.html)
 * ==========================================================================
 * Lê os projetos do Firebase Firestore
 * e renderiza dinamicamente os cards na página pública.
 */

import { db } from "../firebase/firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(function initProjetosPublicos() {
    if (window.__ProjetosPublicosLoaded) return;
    window.__ProjetosPublicosLoaded = true;

    const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80';

    async function init() {
        const grid = document.getElementById('grid-projetos-publicos');
        if (!grid) return;
        bindAssistantPublicActions();
        const projetos = await getProjetosPublicos();
        renderProjetos(grid, projetos);
    }

    async function getProjetosPublicos() {
        try {
            const snapshot = await getDocs(collection(db, "projetos"));
            return snapshot.docs.map((documento) => {
                const dados = documento.data();
                return {
                    id: documento.id,
                    // Firestore usa "titulo"
                    // O card antigo usa "nome"
                    nome: dados.titulo || "Projeto sem nome",
                    descricao: dados.descricao || "",
                    tecnologias: dados.tecnologias || [],
                    imagem: dados.imagem || "",
                    // usa site primeiro, depois github
                    link: dados.site || dados.github || "#",
                    status: dados.status || "Ativo",
                    versao: dados.versao || ""
                };
            });
        } catch (erro) {
            console.error(
                "Erro ao buscar projetos no Firestore:",
                erro
            );
            return [];
        }
    }

    function renderProjetos(grid, projetos) {
        if (!projetos.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Nenhum projeto publicado ainda.';
            empty.style.cssText = 'color: var(--text-secondary); grid-column: 1 / -1; text-align: center; padding: 48px 16px; font-size: 1.1rem;';
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
        status.textContent = projeto.status || 'Ativo';
        status.className = 'project-status';
        version.textContent = projeto.versao || '';
        version.className = 'project-version';
        if (projeto.versao) meta.append(status, version);
        else meta.appendChild(status);

        title.className = 'project-title';
        title.textContent = projeto.nome;

        description.className = 'project-desc';
        description.textContent = projeto.descricao;

        techList.className = 'project-tech';
        (projeto.tecnologias || []).forEach((tecnologia) => {
            const badge = document.createElement('span');
            badge.className = 'tech-badge';
            badge.textContent = tecnologia;
            techList.appendChild(badge);
        });

        link.href = projectUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'project-link';
        link.textContent = projectUrl !== '#' ? 'Acessar Projeto' : 'Ver Repositório';

        article.append(image, meta, title, description, techList, link);
        return article;
    }

    function getProjetosPublicos() {
        // Usa o Store se disponível (quando carregado via admin)
        if (window.Store && typeof window.Store.getProjetos === 'function') {
            return window.Store.getProjetos();
        }

        // Fallback: lê diretamente do LocalStorage com a mesma chave
        try {
            const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
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
        } catch {
            return fallback;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
