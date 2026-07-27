/**
 * ==========================================================================
 * Admin CRUD - Gerenciamento de Projetos (admin/projetos.html)
 * ==========================================================================
 * Dependências: Store (store.js), UI (components.js)
 */

(function initAdminProjetos() {
    if (window.__AdminProjetosLoaded) return;
    window.__AdminProjetosLoaded = true;

    const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80';

    let editingId = null;
    let deleteTargetId = null;

    /* ------------------------------------------------------------------ */
    /*  Inicialização                                                     */
    /* ------------------------------------------------------------------ */
    function init() {
        setupEventListeners();
        renderTabela();
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

        if (btnNovo) btnNovo.addEventListener('click', () => abrirModalNovo());
        if (btnCancelar) btnCancelar.addEventListener('click', () => fecharModal());
        if (btnCancelarExclusao) btnCancelarExclusao.addEventListener('click', () => fecharModalExclusao());
        if (btnConfirmarExclusao) btnConfirmarExclusao.addEventListener('click', () => confirmarExclusao());
        if (form) form.addEventListener('submit', (e) => handleSubmit(e));

        if (inputBusca) {
            inputBusca.addEventListener('input', () => renderTabela());
        }

        if (filtroStatus) {
            filtroStatus.addEventListener('change', () => renderTabela());
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
    /*  Renderização da Tabela                                            */
    /* ------------------------------------------------------------------ */
    function renderTabela() {
        const tabela = document.getElementById('tabela-projetos');
        if (!tabela) return;

        const projetos = getProjetosFiltrados();
        const fragment = document.createDocumentFragment();

        if (!projetos.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.textContent = 'Nenhum projeto encontrado.';
            cell.style.cssText = 'text-align: center; padding: 40px 16px; color: var(--text-muted);';
            row.appendChild(cell);
            fragment.appendChild(row);
        } else {
            projetos.forEach((projeto) => {
                fragment.appendChild(createProjectRow(projeto));
            });
        }

        tabela.replaceChildren(fragment);
    }

    function getProjetosFiltrados() {
        const projetos = Store.getProjetos();
        const busca = (document.getElementById('input-busca')?.value || '').toLowerCase().trim();
        const filtro = document.getElementById('filtro-status')?.value || 'todos';

        if (!busca && filtro === 'todos') return projetos;

        return projetos.filter((projeto) => {
            if (filtro !== 'todos' && projeto.status !== filtro) return false;
            if (!busca) return true;

            const text = `${projeto.nome} ${projeto.descricao} ${(projeto.tecnologias || []).join(' ')}`.toLowerCase();
            return text.includes(busca);
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Criação de Linhas (delegado para views/projetos.js)               */
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
        name.style.cssText = 'display: block; font-size: 0.95rem; margin-bottom: 4px;';

        badges.style.display = 'flex';
        badges.style.gap = '6px';

        (projeto.tecnologias || []).forEach((tecnologia) => {
            const badge = document.createElement('span');
            badge.textContent = tecnologia;
            badge.style.cssText = 'font-size:0.65rem; padding:2px 8px; background:var(--bg-base); border:1px solid var(--border); border-radius:12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;';
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
    function abrirModalNovo() {
        editingId = null;
        document.getElementById('modal-titulo').textContent = 'Novo Projeto';
        document.getElementById('form-projeto').reset();
        UI.openModal('modal-projeto');
    }

    function abrirModalEditar(id) {
        const projeto = Store.getProjetoById(id);
        if (!projeto) {
            UI.showAlert('Projeto não encontrado.', 'error');
            return;
        }

        editingId = id;
        document.getElementById('modal-titulo').textContent = 'Editar Projeto';
        document.getElementById('proj-nome').value = projeto.nome || '';
        document.getElementById('proj-versao').value = projeto.versao || '';
        document.getElementById('proj-status').value = projeto.status || 'Ativo';
        document.getElementById('proj-tech').value = (projeto.tecnologias || []).join(', ');
        document.getElementById('proj-desc').value = projeto.descricao || '';
        document.getElementById('proj-imagem').value = projeto.imagem || '';
        document.getElementById('proj-link').value = projeto.link || '';
        UI.openModal('modal-projeto');
    }

    function fecharModal() {
        UI.closeModal('modal-projeto');
        editingId = null;
    }

    function handleSubmit(e) {
        e.preventDefault();

        const dados = {
            nome: document.getElementById('proj-nome').value.trim(),
            versao: document.getElementById('proj-versao').value.trim(),
            status: document.getElementById('proj-status').value,
            tecnologias: document.getElementById('proj-tech').value.trim(),
            descricao: document.getElementById('proj-desc').value.trim(),
            imagem: document.getElementById('proj-imagem').value.trim(),
            link: document.getElementById('proj-link').value.trim() || '#'
        };

        if (!dados.nome || !dados.descricao) {
            UI.showAlert('Preencha o nome e a descrição do projeto.', 'error');
            return;
        }

        if (editingId) {
            Store.updateProjeto(editingId, dados);
            UI.showAlert('Projeto atualizado com sucesso!');
        } else {
            Store.addProjeto(dados);
            UI.showAlert('Projeto criado com sucesso!');
        }

        fecharModal();
        renderTabela();
    }

    /* ------------------------------------------------------------------ */
    /*  Modal - Exclusão                                                  */
    /* ------------------------------------------------------------------ */
    function abrirModalExclusao(id) {
        deleteTargetId = id;
        UI.openModal('modal-confirmar-exclusao');
    }

    function fecharModalExclusao() {
        UI.closeModal('modal-confirmar-exclusao');
        deleteTargetId = null;
    }

    function confirmarExclusao() {
        if (!deleteTargetId) return;

        Store.deleteProjeto(deleteTargetId);
        UI.showAlert('Projeto excluído com sucesso!');
        fecharModalExclusao();
        renderTabela();
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

    // Expõe funções para o Assistente IA usar
    window.abrirModalNovo = abrirModalNovo;
})();
