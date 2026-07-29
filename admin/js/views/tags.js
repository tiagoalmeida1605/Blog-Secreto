/**
 * ==========================================================================
 * Admin View - Gerenciamento de Tags (admin/tags.html)
 * ==========================================================================
 * Arquitetura: As Views nunca conversam diretamente com o Firestore.
 * Toda comunicação passa exclusivamente por TagService (js/services/tagService.js).
 * ==========================================================================
 */

import { TagService } from "../services/tagService.js";

(function initAdminTags() {
    if (window.__AdminTagsLoaded) return;
    window.__AdminTagsLoaded = true;

    let cacheTags = [];
    let editingSlug = null;
    let deleteTargetSlug = null;
    let slugManualTouched = false;

    const PRESET_COLORS = [
        "#3776AB", // Python Blue
        "#F7DF1E", // JS Yellow
        "#61DAFB", // React Cyan
        "#41B883", // Vue Green
        "#E34F26", // HTML Orange
        "#1572B6", // CSS Blue
        "#3178C6", // TS Blue
        "#FF4500", // Red-Orange
        "#FFCA28", // Firebase Yellow
        "#339933", // Node Green
        "#007ACC", // VS Code Blue
        "#777BB4", // PHP Purple
        "#2496ED"  // Docker Blue
    ];

    /* ------------------------------------------------------------------ */
    /*  Inicialização                                                     */
    /* ------------------------------------------------------------------ */
    function init() {
        setupEventListeners();
        renderPresetColors();
        renderTabela();
    }

    /* ------------------------------------------------------------------ */
    /*  Event Listeners                                                   */
    /* ------------------------------------------------------------------ */
    function setupEventListeners() {
        const btnNova = document.getElementById('btn-nova-tag');
        const btnCancelar = document.getElementById('btn-cancelar-tag');
        const btnCancelarExclusao = document.getElementById('btn-cancelar-exclusao-tag');
        const btnConfirmarExclusao = document.getElementById('btn-confirmar-exclusao-tag');
        const form = document.getElementById('form-tag');

        const inputBusca = document.getElementById('input-busca-tag');
        const filtroCategoria = document.getElementById('filtro-categoria-tag');
        const filtroOrdenacao = document.getElementById('filtro-ordem-tag');

        const inputNome = document.getElementById('tag-nome');
        const inputSlug = document.getElementById('tag-slug');
        const inputCor = document.getElementById('tag-cor');
        const inputCorHex = document.getElementById('tag-cor-hex');

        if (btnNova) btnNova.addEventListener('click', () => abrirModalNova());
        if (btnCancelar) btnCancelar.addEventListener('click', () => fecharModal());
        if (btnCancelarExclusao) btnCancelarExclusao.addEventListener('click', () => fecharModalExclusao());
        if (btnConfirmarExclusao) btnConfirmarExclusao.addEventListener('click', () => confirmarExclusao());
        if (form) form.addEventListener('submit', (e) => handleSubmit(e));

        // Busca e filtros instantâneos no cache
        if (inputBusca) inputBusca.addEventListener('input', () => renderTabelaFiltrada());
        if (filtroCategoria) filtroCategoria.addEventListener('change', () => renderTabelaFiltrada());
        if (filtroOrdenacao) filtroOrdenacao.addEventListener('change', () => renderTabelaFiltrada());

        // Geração automática de Slug ao digitar Nome
        if (inputNome) {
            inputNome.addEventListener('input', () => {
                if (!slugManualTouched) {
                    inputSlug.value = TagService.generateSlug(inputNome.value);
                }
            });
        }

        // Marca que o usuário editou o slug manualmente
        if (inputSlug) {
            inputSlug.addEventListener('input', () => {
                slugManualTouched = true;
                inputSlug.value = TagService.generateSlug(inputSlug.value);
            });
        }

        // Sincronização do Color Picker com o Hexadecimal
        if (inputCor && inputCorHex) {
            inputCor.addEventListener('input', () => {
                inputCorHex.value = inputCor.value.toUpperCase();
                atualizarSwatchSelecionado(inputCor.value);
            });
            inputCorHex.addEventListener('input', () => {
                let hex = inputCorHex.value.trim();
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (/^#[0-9A-F]{6}$/i.test(hex)) {
                    inputCor.value = hex;
                    atualizarSwatchSelecionado(hex);
                }
            });
        }

        // Preset de emojis
        document.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const iconeInput = document.getElementById('tag-icone');
                if (iconeInput) iconeInput.value = btn.textContent.trim();
            });
        });

        // Delegação de eventos da tabela (Editar / Apagar)
        const tabela = document.getElementById('tabela-tags');
        if (tabela) {
            tabela.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;

                const slug = btn.dataset.tagSlug;
                if (!slug) return;

                if (btn.dataset.action === 'edit') {
                    abrirModalEditar(slug);
                } else if (btn.dataset.action === 'delete') {
                    abrirModalExclusao(slug);
                }
            });
        }

        // Fechar modal no overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Cores predefinidas (Swatches)                                     */
    /* ------------------------------------------------------------------ */
    function renderPresetColors() {
        const container = document.getElementById('preset-colors-container');
        if (!container) return;

        container.replaceChildren();
        PRESET_COLORS.forEach(cor => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-swatch-btn';
            btn.style.backgroundColor = cor;
            btn.title = cor;
            btn.addEventListener('click', () => {
                document.getElementById('tag-cor').value = cor;
                document.getElementById('tag-cor-hex').value = cor.toUpperCase();
                atualizarSwatchSelecionado(cor);
            });
            container.appendChild(btn);
        });
    }

    function atualizarSwatchSelecionado(cor) {
        document.querySelectorAll('.color-swatch-btn').forEach(btn => {
            const ativa = btn.title.toLowerCase() === cor.toLowerCase();
            btn.classList.toggle('active', ativa);
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Carregamento + Renderização da Tabela                             */
    /* ------------------------------------------------------------------ */
    async function renderTabela() {
        const tabela = document.getElementById('tabela-tags');
        if (!tabela) return;

        tabela.replaceChildren(createInfoRow('Carregando tags...'));

        try {
            cacheTags = await TagService.getTags();
            atualizarOpcoesCategoria();
        } catch (erro) {
            console.error('Erro ao carregar tags via TagService:', erro);
            window.UI?.showAlert('Erro ao carregar as tags do Firestore.', 'error');
            cacheTags = [];
        }

        renderTabelaFiltrada();
    }

    function renderTabelaFiltrada() {
        const tabela = document.getElementById('tabela-tags');
        if (!tabela) return;

        const buscaText = document.getElementById('input-busca-tag')?.value || '';
        const categoriaText = document.getElementById('filtro-categoria-tag')?.value || 'todas';
        const ordenacao = document.getElementById('filtro-ordem-tag')?.value || 'ordem';

        let tags = TagService.searchTags(cacheTags, buscaText, categoriaText);

        // Ordenação adicional se selecionada no filtro
        tags = [...tags].sort((a, b) => {
            if (ordenacao === 'nome') {
                return (a.nome || '').localeCompare(b.nome || '');
            }
            if (ordenacao === 'categoria') {
                return (a.categoria || '').localeCompare(b.categoria || '');
            }
            if (ordenacao === 'status') {
                return (b.ativo === true ? 1 : 0) - (a.ativo === true ? 1 : 0);
            }
            // Padrão: por campo 'ordem'
            const ordemA = Number.isFinite(a.ordem) ? a.ordem : 999;
            const ordemB = Number.isFinite(b.ordem) ? b.ordem : 999;
            return ordemA - ordemB;
        });

        const fragment = document.createDocumentFragment();

        if (!tags.length) {
            fragment.appendChild(createInfoRow('Nenhuma tag encontrada.'));
        } else {
            tags.forEach(tag => {
                fragment.appendChild(createTagRow(tag));
            });
        }

        tabela.replaceChildren(fragment);
    }

    function createInfoRow(mensagem) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 9;
        cell.textContent = mensagem;
        cell.style.cssText = 'text-align: center; padding: 40px 16px; color: var(--text-muted);';
        row.appendChild(cell);
        return row;
    }

    function atualizarOpcoesCategoria() {
        const select = document.getElementById('filtro-categoria-tag');
        if (!select) return;

        const categoriasSet = new Set(['Linguagem', 'Framework', 'Ferramenta', 'Banco de Dados', 'Cloud', 'IA', 'Frontend', 'Backend', 'Outros']);
        cacheTags.forEach(t => {
            if (t.categoria) categoriasSet.add(t.categoria);
        });

        const valorAtual = select.value || 'todas';
        select.replaceChildren();

        const optTodas = document.createElement('option');
        optTodas.value = 'todas';
        optTodas.textContent = 'Todas as Categorias';
        select.appendChild(optTodas);

        Array.from(categoriasSet).sort().forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        });

        select.value = valorAtual;
    }

    /* ------------------------------------------------------------------ */
    /*  Criação de Linhas da Tabela                                        */
    /* ------------------------------------------------------------------ */
    function createTagRow(tag) {
        const row = document.createElement('tr');

        // Ícone
        const tdIcone = document.createElement('td');
        tdIcone.style.fontSize = '1.3rem';
        tdIcone.textContent = tag.icone || '🏷️';

        // Nome
        const tdNome = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'tag-badge';
        badge.style.backgroundColor = `${tag.cor || '#3776AB'}20`;
        badge.style.color = tag.cor || '#3776AB';
        badge.style.borderColor = `${tag.cor || '#3776AB'}50`;
        badge.textContent = tag.nome;
        tdNome.appendChild(badge);

        // Slug
        const tdSlug = document.createElement('td');
        const codeSlug = document.createElement('code');
        codeSlug.style.cssText = 'background: var(--bg-base); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); font-size: 0.8rem;';
        codeSlug.textContent = tag.slug;
        tdSlug.appendChild(codeSlug);

        // Categoria
        const tdCategoria = document.createElement('td');
        tdCategoria.textContent = tag.categoria || 'Outros';

        // Descrição
        const tdDesc = document.createElement('td');
        tdDesc.style.cssText = 'max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted); font-size: 0.85rem;';
        tdDesc.textContent = tag.descricao || '-';

        // Cor
        const tdCor = document.createElement('td');
        const colorPill = document.createElement('div');
        colorPill.className = 'color-preview-pill';
        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.backgroundColor = tag.cor || '#3776AB';
        const textHex = document.createElement('span');
        textHex.textContent = (tag.cor || '#3776AB').toUpperCase();
        colorPill.append(dot, textHex);
        tdCor.appendChild(colorPill);

        // Status
        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge ${tag.ativo !== false ? 'status-ativo' : 'status-arquivado'}`;
        statusBadge.textContent = tag.ativo !== false ? 'Ativa' : 'Inativa';
        tdStatus.appendChild(statusBadge);

        // Ordem
        const tdOrdem = document.createElement('td');
        tdOrdem.textContent = tag.ordem ?? 1;

        // Ações
        const tdAcoes = document.createElement('td');
        const wrapperAcoes = document.createElement('div');
        wrapperAcoes.style.cssText = 'display: flex; gap: 8px;';

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'btn btn-icon';
        btnEdit.innerHTML = '<i class="ph ph-pencil-simple"></i>';
        btnEdit.dataset.action = 'edit';
        btnEdit.dataset.tagSlug = tag.slug;
        btnEdit.title = 'Editar Tag';

        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'btn btn-icon';
        btnDelete.innerHTML = '<i class="ph ph-trash" style="color: var(--danger)"></i>';
        btnDelete.dataset.action = 'delete';
        btnDelete.dataset.tagSlug = tag.slug;
        btnDelete.title = 'Excluir Tag';

        wrapperAcoes.append(btnEdit, btnDelete);
        tdAcoes.appendChild(wrapperAcoes);

        row.append(tdIcone, tdNome, tdSlug, tdCategoria, tdDesc, tdCor, tdStatus, tdOrdem, tdAcoes);
        return row;
    }

    /* ------------------------------------------------------------------ */
    /*  Modal Nova / Editar Tag                                           */
    /* ------------------------------------------------------------------ */
    function abrirModalNova() {
        editingSlug = null;
        slugManualTouched = false;

        document.getElementById('modal-tag-titulo').textContent = 'Nova Tag';
        document.getElementById('form-tag').reset();

        document.getElementById('tag-cor').value = '#3776AB';
        document.getElementById('tag-cor-hex').value = '#3776AB';
        document.getElementById('tag-icone').value = '🏷️';
        document.getElementById('tag-ordem').value = cacheTags.length + 1;
        document.getElementById('tag-ativa').checked = true;

        atualizarSwatchSelecionado('#3776AB');
        window.UI?.openModal('modal-tag');
    }

    function abrirModalEditar(slug) {
        const tag = cacheTags.find(t => t.slug === slug);
        if (!tag) {
            window.UI?.showAlert('Tag não encontrada.', 'error');
            return;
        }

        editingSlug = slug;
        slugManualTouched = true;

        document.getElementById('modal-tag-titulo').textContent = `Editar Tag: ${tag.nome}`;
        document.getElementById('tag-nome').value = tag.nome || '';
        document.getElementById('tag-slug').value = tag.slug || '';
        document.getElementById('tag-categoria').value = tag.categoria || 'Outros';
        document.getElementById('tag-cor').value = tag.cor || '#3776AB';
        document.getElementById('tag-cor-hex').value = (tag.cor || '#3776AB').toUpperCase();
        document.getElementById('tag-icone').value = tag.icone || '🏷️';
        document.getElementById('tag-desc').value = tag.descricao || '';
        document.getElementById('tag-ordem').value = tag.ordem ?? 1;
        document.getElementById('tag-ativa').checked = tag.ativo !== false;

        atualizarSwatchSelecionado(tag.cor || '#3776AB');
        window.UI?.openModal('modal-tag');
    }

    function fecharModal() {
        window.UI?.closeModal('modal-tag');
        editingSlug = null;
        slugManualTouched = false;
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const formValues = {
            nome: document.getElementById('tag-nome').value.trim(),
            slug: document.getElementById('tag-slug').value.trim(),
            categoria: document.getElementById('tag-categoria').value.trim() || 'Outros',
            cor: document.getElementById('tag-cor').value.trim() || '#3776AB',
            icone: document.getElementById('tag-icone').value.trim() || '🏷️',
            descricao: document.getElementById('tag-desc').value.trim(),
            ordem: parseInt(document.getElementById('tag-ordem').value, 10) || 1,
            ativo: document.getElementById('tag-ativa').checked
        };

        if (!formValues.nome) {
            window.UI?.showAlert('Preencha o nome da tag.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            if (editingSlug) {
                await TagService.updateTag(editingSlug, formValues);
                window.UI?.showAlert('Tag atualizada com sucesso!');
            } else {
                await TagService.createTag(formValues);
                window.UI?.showAlert('Tag criada com sucesso!');
            }

            fecharModal();
            await renderTabela();
        } catch (erro) {
            console.error('Erro ao salvar tag no Firestore:', erro);
            window.UI?.showAlert(erro.message || 'Erro ao salvar a tag no Firestore.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Modal Exclusão                                                    */
    /* ------------------------------------------------------------------ */
    function abrirModalExclusao(slug) {
        deleteTargetSlug = slug;
        window.UI?.openModal('modal-confirmar-exclusao-tag');
    }

    function fecharModalExclusao() {
        window.UI?.closeModal('modal-confirmar-exclusao-tag');
        deleteTargetSlug = null;
    }

    async function confirmarExclusao() {
        if (!deleteTargetSlug) return;

        try {
            await TagService.deleteTag(deleteTargetSlug);
            window.UI?.showAlert('Tag excluída com sucesso!');
            fecharModalExclusao();
            await renderTabela();
        } catch (erro) {
            console.error('Erro ao excluir tag no Firestore:', erro);
            window.UI?.showAlert(erro.message || 'Erro ao excluir a tag.', 'error');
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Inicialização                                                     */
    /* ------------------------------------------------------------------ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
