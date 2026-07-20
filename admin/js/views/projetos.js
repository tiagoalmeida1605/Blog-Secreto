/**
 * ==========================================================================
 * View: Gerenciamento de Projetos (CRUD Completo + Filtros + Modais)
 * ==========================================================================
 */

(function initProjetosAdminView() {
    if (window.__ProjetosAdminViewLoaded) return;
    window.__ProjetosAdminViewLoaded = true;

    const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/40';

    let idProjetoEmEdicao = null;
    let idProjetoParaExcluir = null;
    let elements = {};

    function init() {
        elements = {
            tabela: document.getElementById('tabela-projetos'),
            form: document.getElementById('form-projeto'),
            inputBusca: document.getElementById('input-busca'),
            selectFiltroStatus: document.getElementById('filtro-status'),
            modalTitulo: document.getElementById('modal-titulo'),
            novoProjeto: document.getElementById('btn-novo-projeto'),
            cancelarProjeto: document.getElementById('btn-cancelar-projeto'),
            cancelarExclusao: document.getElementById('btn-cancelar-exclusao'),
            confirmarExclusao: document.getElementById('btn-confirmar-exclusao'),
            fields: {
                nome: document.getElementById('proj-nome'),
                descricao: document.getElementById('proj-desc'),
                tecnologias: document.getElementById('proj-tech'),
                status: document.getElementById('proj-status'),
                versao: document.getElementById('proj-versao'),
                imagem: document.getElementById('proj-imagem'),
                link: document.getElementById('proj-link')
            }
        };

        bindEvents();
        renderizarTabela();
    }

    function bindEvents() {
        elements.inputBusca?.addEventListener('input', renderizarTabela);
        elements.selectFiltroStatus?.addEventListener('change', renderizarTabela);
        elements.novoProjeto?.addEventListener('click', abrirModalNovo);
        elements.cancelarProjeto?.addEventListener('click', fecharModalForm);
        elements.cancelarExclusao?.addEventListener('click', fecharModalExclusao);
        elements.confirmarExclusao?.addEventListener('click', confirmarExclusao);
        elements.form?.addEventListener('submit', salvarProjeto);
        elements.tabela?.addEventListener('click', handleTabelaClick);
    }

    function renderizarTabela() {
        if (!elements.tabela) return;

        const projetos = filtrarProjetos(Store.getProjetos());

        if (!projetos.length) {
            elements.tabela.replaceChildren(createEmptyRow());
            return;
        }

        const fragment = document.createDocumentFragment();
        projetos.forEach((projeto) => fragment.appendChild(createProjectRow(projeto)));
        elements.tabela.replaceChildren(fragment);
    }

    function filtrarProjetos(projetos) {
        const termoBusca = normalizeForSearch(elements.inputBusca?.value);
        const statusFiltro = elements.selectFiltroStatus?.value || 'todos';
        const statusNormalizado = normalizeForSearch(statusFiltro);

        return projetos.filter((projeto) => {
            const matchesSearch = !termoBusca || [
                projeto.nome,
                projeto.descricao,
                ...(projeto.tecnologias || [])
            ].some((value) => normalizeForSearch(value).includes(termoBusca));

            const matchesStatus = statusNormalizado === 'todos' ||
                normalizeForSearch(projeto.status) === statusNormalizado;

            return matchesSearch && matchesStatus;
        });
    }

    function createEmptyRow() {
        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.colSpan = 5;
        cell.textContent = 'Nenhum projeto encontrado.';
        cell.style.cssText = 'text-align: center; color: var(--text-muted); padding: 32px;';
        row.appendChild(cell);

        return row;
    }

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

        wrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        image.src = safeUrl(projeto.imagem, PLACEHOLDER_IMAGE);
        image.alt = '';
        image.style.cssText = 'width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid var(--border);';
        image.addEventListener('error', () => {
            image.src = PLACEHOLDER_IMAGE;
        }, { once: true });

        name.textContent = projeto.nome;
        badges.style.marginTop = '4px';

        (projeto.tecnologias || []).forEach((tecnologia) => {
            const badge = document.createElement('span');
            badge.className = 'tech-badge';
            badge.textContent = tecnologia;
            badge.style.cssText = 'font-size:11px; padding:2px 8px; background:var(--bg-panel); border:1px solid var(--border); border-radius:12px; margin-right:4px;';
            badges.appendChild(badge);
        });

        content.append(name, badges);
        wrapper.append(image, content);
        cell.appendChild(wrapper);

        return cell;
    }

    function createStatusCell(status) {
        const cell = document.createElement('td');
        const label = document.createElement('span');

        label.textContent = status;
        label.style.color = getStatusColor(status);
        label.style.fontWeight = '600';
        cell.appendChild(label);

        return cell;
    }

    function createVersionCell(versao) {
        const cell = document.createElement('td');
        const code = document.createElement('code');

        code.textContent = versao || '';
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
        const editButton = document.createElement('button');
        const deleteButton = document.createElement('button');

        wrapper.style.cssText = 'display: flex; gap: 8px;';

        editButton.type = 'button';
        editButton.className = 'btn btn-outline';
        editButton.textContent = 'Editar';
        editButton.dataset.action = 'edit';
        editButton.dataset.projectId = projectId;
        editButton.style.cssText = 'padding: 6px 12px; font-size: 12px;';

        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = 'Excluir';
        deleteButton.dataset.action = 'delete';
        deleteButton.dataset.projectId = projectId;
        deleteButton.style.cssText = 'padding: 6px 12px; font-size: 12px;';

        wrapper.append(editButton, deleteButton);
        cell.appendChild(wrapper);

        return cell;
    }

    function handleTabelaClick(event) {
        const button = event.target.closest('[data-action][data-project-id]');
        if (!button || !elements.tabela?.contains(button)) return;

        const projectId = button.dataset.projectId;

        if (button.dataset.action === 'edit') {
            abrirModalEdicao(projectId);
            return;
        }

        if (button.dataset.action === 'delete') {
            abrirModalExclusao(projectId);
        }
    }

    function abrirModalNovo() {
        idProjetoEmEdicao = null;
        elements.form?.reset();
        if (elements.modalTitulo) elements.modalTitulo.textContent = 'Novo Projeto';
        UI.openModal('modal-projeto');
    }

    function abrirModalEdicao(id) {
        const projeto = Store.getProjetoById(id);
        if (!projeto) return;

        idProjetoEmEdicao = projeto.id;
        if (elements.modalTitulo) elements.modalTitulo.textContent = 'Editar Projeto';

        elements.fields.nome.value = projeto.nome || '';
        elements.fields.descricao.value = projeto.descricao || '';
        elements.fields.tecnologias.value = Array.isArray(projeto.tecnologias) ? projeto.tecnologias.join(', ') : '';
        elements.fields.status.value = projeto.status || 'Ativo';
        elements.fields.versao.value = projeto.versao || '';
        elements.fields.imagem.value = projeto.imagem || '';
        elements.fields.link.value = projeto.link || '';

        UI.openModal('modal-projeto');
    }

    function fecharModalForm() {
        UI.closeModal('modal-projeto');
        elements.form?.reset();
        idProjetoEmEdicao = null;
    }

    function salvarProjeto(event) {
        event.preventDefault();

        const dadosProjeto = readProjectForm();
        const projetoSalvo = idProjetoEmEdicao
            ? Store.updateProjeto(idProjetoEmEdicao, dadosProjeto)
            : Store.addProjeto(dadosProjeto);

        if (!projetoSalvo) {
            UI.showAlert('Não foi possível salvar o projeto.', 'danger');
            return;
        }

        UI.showAlert(idProjetoEmEdicao ? 'Projeto atualizado com sucesso!' : 'Novo projeto cadastrado com sucesso!');
        renderizarTabela();
        fecharModalForm();
    }

    function readProjectForm() {
        return {
            nome: elements.fields.nome.value,
            descricao: elements.fields.descricao.value,
            tecnologias: elements.fields.tecnologias.value
                .split(',')
                .map((tecnologia) => tecnologia.trim())
                .filter(Boolean),
            status: elements.fields.status.value,
            versao: elements.fields.versao.value,
            imagem: elements.fields.imagem.value,
            link: elements.fields.link.value || '#'
        };
    }

    function abrirModalExclusao(id) {
        idProjetoParaExcluir = Store.normalizeId(id);
        UI.openModal('modal-confirmar-exclusao');
    }

    function fecharModalExclusao() {
        idProjetoParaExcluir = null;
        UI.closeModal('modal-confirmar-exclusao');
    }

    function confirmarExclusao() {
        if (idProjetoParaExcluir === null) return;

        const removed = Store.deleteProjeto(idProjetoParaExcluir);

        if (removed) {
            renderizarTabela();
            UI.showAlert('Registro excluído do banco.', 'danger');
        } else {
            UI.showAlert('Projeto não encontrado para exclusão.', 'danger');
        }

        fecharModalExclusao();
    }

    function getStatusColor(status) {
        const normalized = normalizeForSearch(status);

        if (normalized === 'ativo') return '#2ecc71';
        if (normalized === 'em teste') return 'var(--accent)';
        return 'var(--text-muted)';
    }

    function safeUrl(url, fallback = '#') {
        const value = String(url || '').trim();
        if (!value || value === '#') return fallback;
        if (/^(javascript|vbscript|data):/i.test(value)) return fallback;
        if (value.startsWith('//')) return fallback;
        if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/') || value.startsWith('#')) return value;

        try {
            const parsed = new URL(value, window.location.href);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : fallback;
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

    window.abrirModalNovo = abrirModalNovo;
    window.abrirModalEdicao = abrirModalEdicao;
    window.fecharModalForm = fecharModalForm;
    window.abrirModalExclusao = abrirModalExclusao;
    window.fecharModalExclusao = fecharModalExclusao;
    window.confirmarExclusao = confirmarExclusao;
    window.renderizarTabelaProjetos = renderizarTabela;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
