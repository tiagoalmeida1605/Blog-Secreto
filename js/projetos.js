/**
 * ==========================================================================
 * Script Público: Exibição dos Projetos (pages/projetos.html)
 * ==========================================================================
 * Busca projetos no Firebase Firestore e tags
 * e renderiza dinamicamente os cards públicos com dados de tags.
 * Registra visualizações com proteção localStorage 24h.
 * ==========================================================================
 */

import { db } from "../firebase/firebase.js";
import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Importa funções de visualização do admin service
import { ProjetoService } from "../admin/js/services/projetoService.js";


(function initProjetosPublicos() {
    if (window.__ProjetosPublicosLoaded) return;
    window.__ProjetosPublicosLoaded = true;

    const FALLBACK_IMAGE =
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80";

    let tagsCache = new Map();

    async function init() {
        const grid = document.getElementById("grid-projetos-publicos");
        if (!grid) return;
        bindAssistantPublicActions();
        await carregarTags();
        const projetos = await getProjetosPublicos();
        renderProjetos(grid, projetos);
        // Registrar visualizações após renderizar (non-blocking)
        registrarViews(projetos);
    }

    async function carregarTags() {
        try {
            const snapshot = await getDocs(collection(db, "tags"));
            tagsCache.clear();
            snapshot.docs.forEach((doc) => {
                tagsCache.set(doc.id, doc.data());
            });
        } catch (erro) {
            console.error("Erro ao carregar tags:", erro);
            tagsCache.clear();
        }
    }

    async function getProjetosPublicos() {
        try {
            const snapshot = await getDocs(
                collection(db, "projetos")
            );

            return snapshot.docs.map((doc) => {
                const dados = doc.data();

                return {
                    id: doc.id,
                    nome: dados.titulo || "Projeto sem nome",
                    descricao: dados.descricao || "",
                    tags: Array.isArray(dados.tags) ? dados.tags : [],
                    imagem: dados.imagem || dados.imageUrl || "",
                    imageUrl: dados.imageUrl || dados.imagem || null,
                    link: dados.site || dados.github || "#",
                    status: dados.status || "Ativo",
                    versao: dados.versao || "",
                    views: typeof dados.views === 'number' ? dados.views : 0
                };
            });

        } catch (erro) {
            console.error(
                "Erro ao carregar projetos:",
                erro
            );
            return [];
        }
    }

    /**
     * Registra visualização para cada projeto (protegido por localStorage 24h).
     * Não bloqueia a renderização.
     */
    async function registrarViews(projetos) {
        for (const projeto of projetos) {
            try {
                await ProjetoService.registrarVisualizacao(projeto.id);
            } catch (erro) {
                console.error(`Erro ao registrar view do projeto ${projeto.id}:`, erro);
            }
        }
    }

    function renderProjetos(grid, projetos) {

        if (!projetos.length) {
            const empty = document.createElement("p");
            empty.textContent =
                "Nenhum projeto publicado ainda.";
            empty.style.cssText =
                `
                color: var(--text-secondary);
                grid-column: 1 / -1;
                text-align: center;
                padding: 48px 16px;
                font-size: 1.1rem;
                `;

            grid.replaceChildren(empty);
            return;
        }

        const fragment =
            document.createDocumentFragment();

        projetos.forEach((projeto) => {
            fragment.appendChild(
                createProjectCard(projeto)
            );
        });

        grid.replaceChildren(fragment);
    }

    function createProjectCard(projeto) {

        const article =
            document.createElement("article");

        const imageWrapper =
            document.createElement("div");

        const image =
            document.createElement("img");

        const meta =
            document.createElement("div");

        const status =
            document.createElement("span");

        const version =
            document.createElement("span");

        const title =
            document.createElement("h3");

        const description =
            document.createElement("p");

        const techList =
            document.createElement("div");

        const link =
            document.createElement("a");

        const projectUrl =
            safeUrl(
                projeto.link,
                "#",
                { allowMailto: true }
            );

        article.className =
            "project-card";


        const hasImage = projeto.imagem && projeto.imagem !== 'null' && projeto.imagem !== 'undefined';

        if (hasImage) {
            imageWrapper.className = "project-image-wrapper";

            const skeleton = document.createElement("div");
            skeleton.className = "skeleton-image";

            image.className = "project-image loading";
            image.src = safeUrl(projeto.imagem, FALLBACK_IMAGE);
            image.alt = projeto.nome;
            image.loading = "lazy";

            image.addEventListener("load", () => {
                image.classList.remove("loading");
                image.classList.add("loaded");
                skeleton.remove();
            }, { once: true });

            image.addEventListener("error", () => {
                image.src = FALLBACK_IMAGE;
                image.classList.remove("loading");
                image.classList.add("loaded");
                skeleton.remove();
            }, { once: true });

            imageWrapper.append(skeleton, image);
        } else {
            imageWrapper.className = "project-image-placeholder";
            const icon = document.createElement("i");
            icon.className = "ph ph-image";
            const label = document.createElement("span");
            label.textContent = "Sem imagem";
            imageWrapper.append(icon, label);
        }




        meta.className =
            "project-meta";


        status.textContent =
            projeto.status;


        status.className =
            "project-status";



        version.textContent =
            projeto.versao;


        version.className =
            "project-version";


        const views =
            document.createElement("span");
        views.className = "project-views";
        views.innerHTML = `👁️ ${ProjetoService.formatarViews(projeto.views)}`;


        if (projeto.versao) {

            meta.append(
                status,
                version,
                views
            );

        } else {

            meta.append(status, version, views);

        }



        title.className =
            "project-title";


        title.textContent =
            projeto.nome;



        description.className =
            "project-desc";


        description.textContent =
            projeto.descricao;



        techList.className =
            "project-tech";



        (projeto.tags || [])
            .forEach((tagSlug) => {

                const tagInfo = tagsCache.get(tagSlug);

                const badge =
                    document.createElement("span");
                badge.className =
                    "tech-badge";

                if (tagInfo) {
                    badge.style.backgroundColor = `${tagInfo.cor || '#3776AB'}25`;
                    badge.style.color = tagInfo.cor || '#3776AB';
                    badge.style.borderColor = `${tagInfo.cor || '#3776AB'}50`;
                    badge.textContent =
                        `${tagInfo.icone || '🏷️'} ${tagInfo.nome}`;
                } else {
                    badge.textContent = tagSlug;
                }

                techList.appendChild(badge);
            });

        link.href =
            projectUrl;

        link.target =
            "_blank";

        link.rel =
            "noopener noreferrer";


        link.className =
            "project-link";


        link.innerHTML =
            `
            <i class="ph ph-arrow-up-right" style="font-size: 1rem;"></i>
            Acessar
            `;

        article.append(
            imageWrapper,
            meta,
            title,
            description,
            techList,
            link
        );

        return article;

    }

    function bindAssistantPublicActions() {
        document
            .querySelectorAll("[data-open-ai-assistant]")
            .forEach((button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const assistant =
                            window.__BlogSecretoAssistant;

                        if (
                            assistant &&
                            assistant.ui &&
                            typeof assistant.ui.open === "function"
                        ) {
                            assistant.ui.open();
                            return;
                        }

                        document
                            .querySelector(".ai-launcher")
                            ?.click();
                    }
                );
            });
    }

    function safeUrl(
        url,
        fallback = "#",
        options = {}
    ) {

        const value =
            String(url || "").trim();

        if (!value || value === "#")
            return fallback;

        if (
            /^(javascript|vbscript|data):/i
                .test(value)
        )
            return fallback;

        if (value.startsWith("//"))
            return fallback;

        if (
            value.startsWith("./") ||
            value.startsWith("../") ||
            value.startsWith("/") ||
            value.startsWith("#")
        )
            return value;
        try {
            const parsed =
                new URL(
                    value,
                    window.location.href
                );

            const allowedProtocols =
                options.allowMailto
                    ? [
                        "http:",
                        "https:",
                        "mailto:"
                    ]
                    : [
                        "http:",
                        "https:"
                    ];

            return allowedProtocols.includes(
                parsed.protocol
            )
                ? parsed.href
                : fallback;

        } catch {
            return fallback;
        }
    }

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );
    } else {
        init();
    }
})();
