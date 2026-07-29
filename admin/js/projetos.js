/**
 * ==========================================================================
 * Admin CRUD - Gerenciamento de Projetos (admin/projetos.html)
 * ==========================================================================
 * Dependências: ProjetoService, TagService, UI (components.js)
 * Fonte de dados: Firebase Firestore, coleções "projetos" e "tags"
 * ==========================================================================
 */

import { TagService } from "./services/tagService.js";
import { ProjetoService } from "./services/projetoService.js";

(function initAdminProjetos() {
    if (window.__AdminProjetosLoaded) return;
    window.__AdminProjetosLoaded = true;

    const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80';

    let editingId = null;
    let deleteTargetId = null;
    let cacheProjetos = [];
    let cacheTags = [];
    let cacheTagsMap = new Map();
    let selectedTagSlugs = new Set();

    /* ------------------------------------------------------------------ */
    /*  Inicialização                                                     */
    /* ------------------------------------------------------------------ */
    async function init() {
        setupEventListeners();
        await carregarTags();
        await renderTabela();
    }

    /* ------------------------------------------------------------------ */
    /*  Carregamento de Tags                                              */
    /* ------------------------------------------------------------------ */
    async function carregarTags() {
        try {
            cacheTags = await TagService.getTags();
            cacheTagsMap = new Map();
            cacheTags.forEach(tag => {
                if (tag.slug) cacheTagsMap.set(tag.slug, tag);
            });
        } catch (erro) {
            console.error('Erro ao carregar tags para o seletor:', erro);
            cacheTags = [];
            cacheTagsMap = new Map();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Event Listeners                                                   */
    /* ------------------------------------------------------------------ */
    function setupEventListeners() {
        const btnNovo = document.getElementById('btn-novo-projeto');
        const btnCancelar = document.getElementById('btn-cancelar-projeto');
        const btnCancelarExclusao = document.getElementById('btn-cancelar-exclusao');
        const btnConfirmarExclusao = document.getElementById('btn-confirmar-exclusao');
        const form = document.getElementById('form-projeto');
        const inputBusca = document.getElementById('input-busca');
        const filtroStatus = document.getElementById('filtro-status');

        const inputTagsSearch = document.getElementById('proj-tags-search');

        if (btnNovo) btnNovo.addEventListener('click', () => abrirModalNovo());
        if (btnCancelar) btnCancelar.addEventListener('click', () => fecharModal());
        if (btnCancelarExclusao) btnCancelarExclusao.addEventListener('click', () => fecharModalExclusao());
        if (btnConfirmarExclusao) btnConfirmarExclusao.addEventListener('click', () => confirmarExclusao());
        if (form) form.addEventListener('submit', (e) => handleSubmit(e));

        if (inputBusca) inputBusca.addEventListener('input', () => renderTabelaFiltrada());
        if (filtroStatus) filtroStatus.addEventListener('change', () => renderTabelaFiltrada());

        // Busca interna do seletor de tags
        if (inputTagsSearch) {
            inputTagsSearch.addEventListener('input', (e) => {
                renderGridTagsSeletor(e.target.value);
            });
        }

        // Delegação de eventos para botões de ação nas linhas
        const tabela = document.getElementById('tabela-projetos');
        if (tabela) {
            tabela.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;

                const projectId = btn.dataset.projectId;
                if (!projectId) return;

                if (btn.dataset.action === 'edit') {
                    abrirModalEditar(projectId);
                } else if (btn.dataset.action === 'delete') {
                    abrirModalExclusao(projectId);
                }
            });
        }

        // Fechar modal ao clicar no overlay
        document.querySelectorAll('.modal-overlay').forEach((overlay) => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Seletor Interativo de Tags                                        */
    /* ------------------------------------------------------------------ */
    function prepararSeletorTags(initialSlugs = []) {
        selectedTagSlugs = new Set(initialSlugs);
        const searchInput = document.getElementById('proj-tags-search');
        if (searchInput) searchInput.value = '';

        renderGridTagsSeletor();
        renderBadgesTagsSelecionadas();
    }

    function renderGridTagsSeletor(filtroTexto = '') {
        const grid = document.getElementById('proj-tags-grid');
        if (!grid) return;

        const busca = (filtroTexto || '').toLowerCase().trim();

        const tagsFiltradas = cacheTags.filter(tag => {
            if (tag.ativo === false) return false;
            if (!busca) return true;
            return `${tag.nome} ${tag.slug} ${tag.categoria}`.toLowerCase().includes(busca);
        });

        if (!tagsFiltradas.length) {
            grid.replaceChildren();
            const emptyMsg = document.createElement('span');
            emptyMsg.style.cssText = 'color: var(--text-muted); font-size: 0.85rem; padding: 8px; grid-column: 1/-1;';
            emptyMsg.textContent = cacheTags.length ? 'Nenhuma tag encontrada.' : 'Nenhuma tag cadastrada no sistema.';
            grid.appendChild(emptyMsg);
            return;
        }

        const fragment = document.createDocumentFragment();

        tagsFiltradas.forEach(tag => {
            const isSelected = selectedTagSlugs.has(tag.slug);

            const label = document.createElement('label');
            label.className = `tag-selector-item ${isSelected ? 'selected' : ''}`;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = tag.slug;
            checkbox.checked = isSelected;

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedTagSlugs.add(tag.slug);
                    label.classList.add('selected');
                } else {
                    selectedTagSlugs.delete(tag.slug);
                    label.classList.remove('selected');
                }
                renderBadgesTagsSelecionadas();
            });

            const iconSpan = document.createElement('span');
            iconSpan.textContent = tag.icone || '🏷️';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = tag.nome;
            nameSpan.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

            label.append(checkbox, iconSpan, nameSpan);
            fragment.appendChild(label);
        });

        grid.replaceChildren(fragment);
    }

    function renderBadgesTagsSelecionadas() {
        const container = document.getElementById('proj-tags-selected-display');
        if (!container) return;

        container.replaceChildren();

        if (selectedTagSlugs.size === 0) {
            const hint = document.createElement('span');
            hint.style.cssText = 'color: var(--text-muted); font-size: 0.8rem; font-style: italic;';
            hint.textContent = 'Nenhuma tag selecionada.';
            container.appendChild(hint);
            return;
        }

        selectedTagSlugs.forEach(slug => {
            const tagInfo = cacheTagsMap.get(slug) || { nome: slug, cor: '#3776AB', icone: '🏷️' };

            const badge = document.createElement('span');
            badge.className = 'tag-badge';
            badge.style.backgroundColor = `${tagInfo.cor || '#3776AB'}25`;
            badge.style.color = tagInfo.cor || '#3776AB';
            badge.style.borderColor = `${tagInfo.cor || '#3776AB'}60`;
            badge.style.fontSize = '0.78rem';
            badge.style.padding = '3px 10px';

            badge.textContent = `${tagInfo.icone || '🏷️'} ${tagInfo.nome}`;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.style.cssText = 'background: none; border: none; color: inherit; cursor: pointer; font-size: 0.85rem; margin-left: 4px; padding: 0; line-height: 1;';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = `Remover ${tagInfo.nome}`;
            removeBtn.addEventListener('click', () => {
                selectedTagSlugs.delete(slug);
                renderGridTagsSeletor(document.getElementById('proj-tags-search')?.value || '');
                renderBadgesTagsSelecionadas();
            });

            badge.appendChild(removeBtn);
            container.appendChild(badge);
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Carregamento (Firestore) + Renderização da Tabela                 */
    /* ------------------------------------------------------------------ */
    async function renderTabela() {
        const tabela = document.getElementById('tabela-projetos');
        if (!tabela) return;

        tabela.replaceChildren(createInfoRow('Carregando projetos...'));

        try {
            await carregarTags();
            cacheProjetos = await ProjetoService.getProjetos();
        } catch (erro) {
            console.error('Erro ao carregar projetos do Firestore:', erro);
            window.UI?.showAlert('Não foi possível carregar os projetos do Firestore.', 'error');
            cacheProjetos = [];
        }

        renderTabelaFiltrada();
    }

    function renderTabelaFiltrada() {
        const tabela = document.getElementById('tabela-projetos');
        if (!tabela) return;

        const projetos = getProjetosFiltrados();
        const fragment = document.createDocumentFragment();

        if (!projetos.length) {
            fragment.appendChild(createInfoRow('Nenhum projeto encontrado.'));
        } else {
            projetos.forEach((projeto) => {
                fragment.appendChild(createProjectRow(projeto));
            });
        }

        tabela.replaceChildren(fragment);
    }

    function createInfoRow(mensagem) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = mensagem;
        cell.style.cssText = 'text-align: center; padding: 40px 16px; color: var(--text-muted);';
        row.appendChild(cell);
        return row;
    }

    function getProjetosFiltrados() {
        const busca = (document.getElementById('input-busca')?.value || '').toLowerCase().trim();
        const filtro = document.getElementById('filtro-status')?.value || 'todos';

        return cacheProjetos
            .map(normalizeProjetoParaExibicao)
            .filter((projeto) => {
                if (filtro !== 'todos' && projeto.status !== filtro) return false;
                if (!busca) return true;

                const nomesTags = (projeto.tags || []).map(slug => {
                    const tagObj = cacheTagsMap.get(slug);
                    return tagObj ? `${tagObj.nome} ${slug}` : slug;
                }).join(' ');

                const text = `${projeto.nome} ${projeto.descricao} ${nomesTags}`.toLowerCase();
                return text.includes(busca);
            });
    }

    /* ------------------------------------------------------------------ */
    /*  Normalização (Firestore <-> Formulário)                           */
    /* ------------------------------------------------------------------ */
    function normalizeProjetoParaExibicao(doc) {
        let tagSlugs = [];

        if (Array.isArray(doc.tags)) {
            tagSlugs = doc.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean);
        }
        else if (Array.isArray(doc.tecnologias)) {
            tagSlugs = doc.tecnologias.map(t => TagService.generateSlug(t)).filter(Boolean);
        } else if (doc.tecnologias) {
            tagSlugs = String(doc.tecnologias)
                .split(',')
                .map(t => TagService.generateSlug(t.trim()))
                .filter(Boolean);
        }

        return {
            id: doc.id,
            nome: doc.titulo || doc.nome || 'Projeto sem nome',
            descricao: doc.descricao || '',
            tags: tagSlugs,
            imagem: doc.imagem || '',
            link: doc.site || doc.github || doc.link || '#',
            status: doc.status || 'Ativo',
            versao: doc.versao || ''
        };
    }

    function montarDadosParaFirestore(form) {
        return {
            titulo: form.nome,
            descricao: form.descricao,
            status: form.status,
            versao: form.versao,
            tags: Array.from(selectedTagSlugs),
            imagem: form.imagem,
            site: form.link
        };
    }

    /* ------------------------------------------------------------------ */
    /*  Criação de Linhas                                                 */
    /* ------------------------------------------------------------------ */
    function createProjectRow(projeto) {
        const row = document.createElement('tr');
        row.append(
            createProjectInfoCell(projeto),
            createStatusCell(projeto.status),
            createVersionCell(projeto.versao),
            createDescriptionCell(projeto.descricao),
            createActionsCell(projeto.id)
        );
        return row;
    }

    function createProjectInfoCell(projeto) {
        const cell = document.createElement('td');
        const wrapper = document.createElement('div');
        const image = document.createElement('img');
        const content = document.createElement('div');
        const name = document.createElement('strong');
        const badges = document.createElement('div');

        wrapper.style.cssText = 'display: flex; align-items: center; gap: 16px;';

        image.src = safeUrl(projeto.imagem, PLACEHOLDER_IMAGE);
        image.alt = '';
        image.style.cssText = 'width:44px; height:44px; border-radius:10px; object-fit:cover; border:1px solid var(--border);';
        image.addEventListener('error', () => image.src = PLACEHOLDER_IMAGE, { once: true });

        name.textContent = projeto.nome;
        name.style.cssText = 'display: block; font-size: 0.95rem; margin-bottom: 6px;';

        badges.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

        (projeto.tags || []).forEach((slug) => {
            const tagInfo = cacheTagsMap.get(slug) || { nome: slug, cor: '#888888', icone: '🏷️' };

            const badge = document.createElement('span');
            badge.className = 'tag-badge';
            badge.style.backgroundColor = `${tagInfo.cor || '#888888'}20`;
            badge.style.color = tagInfo.cor || '#888888';
            badge.style.borderColor = `${tagInfo.cor || '#888888'}50`;
            badge.style.fontSize = '0.68rem';
            badge.style.padding = '2px 8px';

            badge.textContent = `${tagInfo.icone || '🏷️'} ${tagInfo.nome}`;
            badges.appendChild(badge);
        });

        content.append(name, badges);
        wrapper.append(image, content);
        cell.appendChild(wrapper);
        return cell;
    }

    function createStatusCell(status) {
        const cell = document.createElement('td');
        const badge = document.createElement('span');

        const normalized = normalizeForSearch(status);
        let statusClass = 'status-arquivado';
        if (normalized === 'ativo') statusClass = 'status-ativo';
        if (normalized === 'em teste') statusClass = 'status-teste';

        badge.className = `status-badge ${statusClass}`;
        badge.textContent = status;

        cell.appendChild(badge);
        return cell;
    }

    function createVersionCell(versao) {
        const cell = document.createElement('td');
        const code = document.createElement('span');
        code.textContent = versao || '-';
        code.style.cssText = 'font-family: monospace; background: var(--bg-base); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; border: 1px solid var(--border);';
        cell.appendChild(code);
        return cell;
    }

    function createDescriptionCell(descricao) {
        const cell = document.createElement('td');
        cell.textContent = descricao || '';
        cell.style.cssText = 'max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted); font-size: 0.85rem;';
        return cell;
    }

    function createActionsCell(projectId) {
        const cell = document.createElement('td');
        const wrapper = document.createElement('div');

        wrapper.style.cssText = 'display: flex; gap: 8px;';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn btn-icon';
        editButton.innerHTML = '<i class="ph ph-pencil-simple"></i>';
        editButton.dataset.action = 'edit';
        editButton.dataset.projectId = projectId;
        editButton.title = 'Editar';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-icon';
        deleteButton.innerHTML = '<i class="ph ph-trash" style="color: var(--danger)"></i>';
        deleteButton.dataset.action = 'delete';
        deleteButton.dataset.projectId = projectId;
        deleteButton.title = 'Excluir';

        wrapper.append(editButton, deleteButton);
        cell.appendChild(wrapper);
        return cell;
    }

    /* ------------------------------------------------------------------ */
    /*  Modal - Novo / Editar                                             */
    /* ------------------------------------------------------------------ */
    async function abrirModalNovo() {
        editingId = null;
        document.getElementById('modal-titulo').textContent = 'Novo Projeto';
        document.getElementById('form-projeto').reset();
        await carregarTags();
        prepararSeletorTags([]);
        window.UI?.openModal('modal-projeto');
    }

    async function abrirModalEditar(id) {
        const doc = cacheProjetos.find((p) => p.id === id);
        if (!doc) {
            window.UI?.showAlert('Projeto não encontrado.', 'error');
            return;
        }

        const projeto = normalizeProjetoParaExibicao(doc);

        editingId = id;
        document.getElementById('modal-titulo').textContent = 'Editar Projeto';
        document.getElementById('proj-nome').value = projeto.nome || '';
        document.getElementById('proj-versao').value = projeto.versao || '';
        document.getElementById('proj-status').value = projeto.status || 'Ativo';
        document.getElementById('proj-desc').value = projeto.descricao || '';
        document.getElementById('proj-imagem').value = projeto.imagem || '';
        document.getElementById('proj-link').value = projeto.link || '';

        await carregarTags();
        prepararSeletorTags(projeto.tags || []);
        window.UI?.openModal('modal-projeto');
    }

    function fecharModal() {
        window.UI?.closeModal('modal-projeto');
        editingId = null;
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const formValues = {
            nome: document.getElementById('proj-nome').value.trim(),
            versao: document.getElementById('proj-versao').value.trim(),
            status: document.getElementById('proj-status').value,
            descricao: document.getElementById('proj-desc').value.trim(),
            imagem: document.getElementById('proj-imagem').value.trim(),
            link: document.getElementById('proj-link').value.trim() || '#'
        };

        if (!formValues.nome || !formValues.descricao) {
            window.UI?.showAlert('Preencha o nome e a descrição do projeto.', 'error');
            return;
        }

        const dados = montarDadosParaFirestore(formValues);
        const submitButton = e.target.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        try {
            if (editingId) {
                await ProjetoService.updateProjeto(editingId, dados);
                window.UI?.showAlert('Projeto atualizado com sucesso!');
            } else {
                await ProjetoService.createProjeto(dados);
                window.UI?.showAlert('Projeto criado com sucesso!');
            }

            fecharModal();
            await renderTabela();
        } catch (erro) {
            console.error('Erro ao salvar projeto no Firestore:', erro);
            window.UI?.showAlert('Erro ao salvar o projeto no Firestore.', 'error');
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Modal - Exclusão                                                  */
    /* ------------------------------------------------------------------ */
    function abrirModalExclusao(id) {
        deleteTargetId = id;
        window.UI?.openModal('modal-confirmar-exclusao');
    }

    function fecharModalExclusao() {
        window.UI?.closeModal('modal-confirmar-exclusao');
        deleteTargetId = null;
    }

    async function confirmarExclusao() {
        if (!deleteTargetId) return;

        try {
            await ProjetoService.deleteProjeto(deleteTargetId);
            window.UI?.showAlert('Projeto excluído com sucesso!');
            fecharModalExclusao();
            await renderTabela();
        } catch (erro) {
            console.error('Erro ao excluir projeto no Firestore:', erro);
            window.UI?.showAlert('Erro ao excluir o projeto no Firestore.', 'error');
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Utilitários                                                       */
    /* ------------------------------------------------------------------ */
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

    function normalizeForSearch(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    /* ------------------------------------------------------------------ */
    /*  Inicialização                                                     */
    /* ------------------------------------------------------------------ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.abrirModalNovo = abrirModalNovo;
})();
