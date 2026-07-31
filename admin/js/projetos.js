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
import { ImageService } from "./services/imageService.js";

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

    // Estado da imagem
    let currentImageState = {
        file: null,          // Arquivo selecionado para upload
        existingImageUrl: null, // URL da imagem existente (edição)
        existingImagePath: null, // Path da imagem existente (edição)
        hasExistingImage: false, // Se já existe imagem no projeto
        uploadInProgress: false, // Se há upload em andamento
        needsUpload: false       // Se precisa fazer upload ao salvar
    };

    /* ------------------------------------------------------------------ */
    /*  Inicialização                                                     */
    /* ------------------------------------------------------------------ */
    async function init() {
        setupEventListeners();
        setupImageUploadUI();
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
    /*  Image Upload UI                                                   */
    /* ------------------------------------------------------------------ */
    function setupImageUploadUI() {
        const dropzone = document.getElementById('image-dropzone');
        const fileInput = document.getElementById('proj-imagem-input');
        const trocarBtn = document.getElementById('btn-trocar-imagem');
        const removerBtn = document.getElementById('btn-remover-imagem');
        const errorMsg = document.getElementById('image-error-msg');

        if (!dropzone || !fileInput) return;

        // Clique no dropzone abre o seletor de arquivos
        dropzone.addEventListener('click', (e) => {
            if (currentImageState.hasExistingImage || currentImageState.file) return;
            fileInput.click();
        });

        // Botão "Trocar" reabre o seletor
        trocarBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        // Botão "Remover" remove a imagem
        removerBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmarRemocaoImagem();
        });

        // Input file change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                processarArquivoSelecionado(file);
            }
            fileInput.value = '';
        });

        // Drag and Drop
        setupDragDrop(dropzone);

        // Fechar erro ao clicar
        errorMsg?.addEventListener('click', () => {
            errorMsg.style.display = 'none';
            errorMsg.textContent = '';
        });
    }

    function setupDragDrop(dropzone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => {
                if (!currentImageState.hasExistingImage && !currentImageState.file) {
                    dropzone.classList.add('drag-over');
                }
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => {
                dropzone.classList.remove('drag-over');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            if (currentImageState.hasExistingImage || currentImageState.file) return;
            const files = e.dataTransfer?.files;
            if (files?.length) {
                processarArquivoSelecionado(files[0]);
            }
        });
    }

    function processarArquivoSelecionado(file) {
        const errorMsg = document.getElementById('image-error-msg');
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';

        const validacao = ImageService.validarArquivo(file);
        if (!validacao.valido) {
            mostrarErroImagem(validacao.erro);
            return;
        }

        mostrarPreviewImediato(file);
    }

    function mostrarErroImagem(mensagem) {
        const errorMsg = document.getElementById('image-error-msg');
        if (errorMsg) {
            errorMsg.textContent = mensagem;
            errorMsg.style.display = 'flex';
            setTimeout(() => {
                errorMsg.style.opacity = '0';
                setTimeout(() => {
                    errorMsg.style.display = 'none';
                    errorMsg.style.opacity = '1';
                }, 300);
            }, 5000);
        }
    }

    function mostrarPreviewImediato(file) {
        const dropzone = document.getElementById('image-dropzone');
        const placeholder = document.getElementById('image-upload-placeholder');
        const previewWrapper = document.getElementById('image-preview-wrapper');
        const previewImg = document.getElementById('image-preview');
        const uploadInfo = document.getElementById('image-upload-info');
        const fileName = document.getElementById('image-file-name');
        const fileSize = document.getElementById('image-file-size');

        currentImageState.file = file;
        currentImageState.needsUpload = true;

        // Mostrar informações do arquivo
        if (uploadInfo) {
            fileName.textContent = file.name;
            fileSize.textContent = ImageService.formatarTamanho(file.size);
            uploadInfo.style.display = 'flex';
        }

        // Preview
        if (previewImg) {
            ImageService.removerPreview(previewImg);
            ImageService.criarPreview(file, previewImg).catch(() => {
                mostrarErroImagem('Não foi possível gerar o preview da imagem.');
            });
        }

        placeholder.style.display = 'none';
        previewWrapper.style.display = 'flex';
        dropzone.classList.add('has-image');
    }

    function mostrarPreviewExistente(imageUrl) {
        const dropzone = document.getElementById('image-dropzone');
        const placeholder = document.getElementById('image-upload-placeholder');
        const previewWrapper = document.getElementById('image-preview-wrapper');
        const previewImg = document.getElementById('image-preview');
        const uploadInfo = document.getElementById('image-upload-info');
        const progressContainer = document.getElementById('image-upload-progress');

        if (previewImg) {
            previewImg.src = imageUrl;
            previewImg.style.display = 'block';
        }

        placeholder.style.display = 'none';
        previewWrapper.style.display = 'flex';
        dropzone.classList.add('has-image');
        uploadInfo.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'none';
    }

    function limparPreviewImagem() {
        const dropzone = document.getElementById('image-dropzone');
        const placeholder = document.getElementById('image-upload-placeholder');
        const previewWrapper = document.getElementById('image-preview-wrapper');
        const previewImg = document.getElementById('image-preview');
        const uploadInfo = document.getElementById('image-upload-info');
        const progressContainer = document.getElementById('image-upload-progress');
        const progressFill = document.getElementById('progress-bar-fill');
        const progressText = document.getElementById('progress-text');
        const errorMsg = document.getElementById('image-error-msg');

        ImageService.removerPreview(previewImg);
        placeholder.style.display = 'flex';
        previewWrapper.style.display = 'none';
        dropzone.classList.remove('has-image');
        uploadInfo.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        if (errorMsg) {
            errorMsg.style.display = 'none';
            errorMsg.textContent = '';
        }
    }

    function mostrarProgressoUpload(percentual) {
        const progressContainer = document.getElementById('image-upload-progress');
        const progressFill = document.getElementById('progress-bar-fill');
        const progressText = document.getElementById('progress-text');

        if (progressContainer) progressContainer.style.display = 'flex';
        if (progressFill) progressFill.style.width = `${percentual}%`;
        if (progressText) progressText.textContent = `${percentual}%`;
    }

    function confirmarRemocaoImagem() {
        if (currentImageState.uploadInProgress) return;

        if (window.confirm('Tem certeza que deseja remover esta imagem?')) {
            if (currentImageState.hasExistingImage) {
                currentImageState.removeExistingOnSave = true;
                currentImageState.hasExistingImage = false;
                currentImageState.file = null;
                currentImageState.needsUpload = false;
            } else {
                currentImageState.file = null;
                currentImageState.needsUpload = false;
            }
            limparPreviewImagem();
        }
    }

    function resetarEstadoImagem() {
        currentImageState = {
            file: null,
            existingImageUrl: null,
            existingImagePath: null,
            hasExistingImage: false,
            uploadInProgress: false,
            needsUpload: false,
            removeExistingOnSave: false
        };
        limparPreviewImagem();
    }

    /* ------------------------------------------------------------------ */
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
            imagem: doc.imagem || doc.imageUrl || '',
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
            imagem: currentImageState.existingImageUrl || form.imagem || '',
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
        resetarEstadoImagem();
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
        const dadosCompletos = doc;

        editingId = id;
        document.getElementById('modal-titulo').textContent = 'Editar Projeto';
        document.getElementById('proj-nome').value = projeto.nome || '';
        document.getElementById('proj-versao').value = projeto.versao || '';
        document.getElementById('proj-status').value = projeto.status || 'Ativo';
        document.getElementById('proj-desc').value = projeto.descricao || '';
        document.getElementById('proj-link').value = projeto.link || '';

        // Configurar estado da imagem existente
        resetarEstadoImagem();
        const imgUrl = projeto.imagem || dadosCompletos.imageUrl || '';
        if (imgUrl) {
            currentImageState.existingImageUrl = imgUrl;
            currentImageState.existingImagePath = dadosCompletos.imagePath || null;
            currentImageState.hasExistingImage = true;
            mostrarPreviewExistente(imgUrl);
        }

        await carregarTags();
        prepararSeletorTags(projeto.tags || []);
        window.UI?.openModal('modal-projeto');
    }

    function fecharModal() {
        window.UI?.closeModal('modal-projeto');
        editingId = null;
        resetarEstadoImagem();
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const formValues = {
            nome: document.getElementById('proj-nome').value.trim(),
            versao: document.getElementById('proj-versao').value.trim(),
            status: document.getElementById('proj-status').value,
            descricao: document.getElementById('proj-desc').value.trim(),
            link: document.getElementById('proj-link').value.trim() || '#'
        };

        if (!formValues.nome || !formValues.descricao) {
            window.UI?.showAlert('Preencha o nome e a descrição do projeto.', 'error');
            return;
        }

        const submitButton = e.target.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        currentImageState.uploadInProgress = true;

        try {
            // ---- ETAPA 1: Excluir imagem antiga (se necessário na edição) ----
            if (editingId && currentImageState.removeExistingOnSave && currentImageState.existingImagePath) {
                await ImageService.excluirImagem(currentImageState.existingImagePath);
            }

            // ---- ETAPA 2: Criar ou preparar o documento no Firestore ----
            const dadosBase = montarDadosParaFirestore(formValues);
            let projectId = editingId;

            if (editingId) {
                // Edição: preservar dados existentes se não houve alteração na imagem
                if (!currentImageState.needsUpload && !currentImageState.removeExistingOnSave
                    && currentImageState.hasExistingImage) {
                    const doc = cacheProjetos.find((p) => p.id === editingId);
                    dadosBase.imagem = doc?.imagem || doc?.imageUrl || '';
                }
            } else {
                // Criação: salvar primeiro no Firestore para obter o ID
                const novoProjeto = await ProjetoService.createProjeto(dadosBase);
                projectId = novoProjeto.id;
            }

            // ---- ETAPA 3: Upload da nova imagem (se houver) ----
            let imageData = {};
            if (currentImageState.file && currentImageState.needsUpload) {
                // Comprimir a imagem
                const blobComprimido = await ImageService.comprimirImagem(currentImageState.file);
                const compressedFile = new File(
                    [blobComprimido],
                    currentImageState.file.name.replace(/\.[^.]+$/, '.webp'),
                    { type: 'image/webp' }
                );

                // Se editando e tinha imagem (e não foi já removida acima), excluir antiga
                if (editingId && currentImageState.existingImagePath && !currentImageState.removeExistingOnSave) {
                    try {
                        await ImageService.excluirImagem(currentImageState.existingImagePath);
                    } catch (erro) {
                        console.warn('Aviso ao excluir imagem antiga:', erro);
                    }
                }

                // Upload com progresso
                const resultado = await ImageService.uploadImagem(
                    projectId,
                    compressedFile,
                    (progresso) => mostrarProgressoUpload(progresso)
                );

                imageData = {
                    imageUrl: resultado.downloadURL,
                    imagePath: resultado.path,
                    imageType: resultado.type,
                    imageSize: resultado.size,
                    imageUploadedAt: new Date().toISOString()
                };
            } else if (currentImageState.removeExistingOnSave) {
                // Removeu a imagem existente e não tem nova
                imageData = {
                    imageUrl: null,
                    imagePath: null,
                    imageType: null,
                    imageSize: null,
                    imageUploadedAt: null,
                    imagem: ''
                };
            }

            // ---- ETAPA 4: Finalizar salvamento ----
            const dados = { ...dadosBase, ...imageData };

            if (editingId) {
                await ProjetoService.updateProjeto(editingId, dados);
                window.UI?.showAlert('Projeto atualizado com sucesso!');
            } else {
                // Para novo projeto, atualizar com dados da imagem
                if (imageData.imageUrl) {
                    await ProjetoService.updateProjeto(projectId, dados);
                }
                window.UI?.showAlert('Projeto criado com sucesso!');
            }

            fecharModal();
            await renderTabela();
        } catch (erro) {
            console.error('Erro ao salvar projeto:', erro);
            window.UI?.showAlert(erro.message || 'Erro ao salvar o projeto.', 'error');
        } finally {
            if (submitButton) submitButton.disabled = false;
            currentImageState.uploadInProgress = false;
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

        const confirmBtn = document.getElementById('btn-confirmar-exclusao');
        if (confirmBtn) confirmBtn.disabled = true;

        try {
            // Buscar dados completos do projeto para obter imagePath
            const projeto = cacheProjetos.find(p => p.id === deleteTargetId);

            // Excluir imagem do Storage se existir
            const imagePath = projeto?.imagePath || null;
            if (imagePath) {
                try {
                    await ImageService.excluirImagem(imagePath);
                } catch (erro) {
                    console.warn('Aviso ao excluir imagem do Storage:', erro);
                }
            }

            // Excluir documento do Firestore
            await ProjetoService.deleteProjeto(deleteTargetId);
            window.UI?.showAlert('Projeto excluído com sucesso!');
            fecharModalExclusao();
            await renderTabela();
        } catch (erro) {
            console.error('Erro ao excluir projeto:', erro);
            window.UI?.showAlert('Erro ao excluir o projeto.', 'error');
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
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
