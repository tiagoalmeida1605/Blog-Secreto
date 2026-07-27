/**
 * ==========================================================================
 * Admin CRUD - Gerenciamento de Projetos (admin/projetos.html)
 * ==========================================================================
 * Dependências: FirebaseStore (js/firebase-store.js), UI (components.js)
 * Fonte de dados: Firebase Firestore, coleção "projetos"
 *
 * Observação sobre nomes de campos:
 * O documento no Firestore usa os campos "titulo" e "site"/"github"
 * (mesmo formato lido pela página pública em ../js/projetos.js).
 * As funções normalizeProjetoParaExibicao() e montarDadosParaFirestore()
 * fazem a ponte entre esse formato e os campos do formulário (nome, link).
 * ==========================================================================
 */

(function initAdminProjetos() {
    if (window.__AdminProjetosLoaded) return;
    window.__AdminProjetosLoaded = true;

    const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80';

    let editingId = null;
    let deleteTargetId = null;
    let cacheProjetos = []; // últimos documentos crus vindos do Firestore

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

        // Busca/filtro usam o cache local (instantâneo, sem nova leitura no Firestore)
        if (inputBusca) inputBusca.addEventListener('input', () => renderTabelaFiltrada());
        if (filtroStatus) filtroStatus.addEventListener('change', () => renderTabelaFiltrada());

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
    /*  Carregamento (Firestore) + Renderização da Tabela                 */
    /* ------------------------------------------------------------------ */
    async function renderTabela() {
        const tabela = document.getElementById('tabela-projetos');
        if (!tabela) return;

        tabela.replaceChildren(createInfoRow('Carregando projetos...'));

        try {
            cacheProjetos = await FirebaseStore.getProjetos();
        } catch (erro) {
            console.error('Erro ao carregar projetos do Firestore:', erro);
            UI.showAlert('Não foi possível carregar os projetos do Firestore. Veja o console.', 'error');
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

                const text = `${projeto.nome} ${projeto.descricao} ${(projeto.tecnologias || []).join(' ')}`.toLowerCase();
                return text.includes(busca);
            });
    }

    /* ------------------------------------------------------------------ */
    /*  Normalização (Firestore <-> Formulário)                           */
    /* ------------------------------------------------------------------ */
    function normalizeProjetoParaExibicao(doc) {
        return {
            id: doc.id,
            nome: doc.titulo || doc.nome || 'Projeto sem nome',
            descricao: doc.descricao || '',
            tecnologias: Array.isArray(doc.tecnologias)
                ? doc.tecnologias
                : String(doc.tecnologias || '').split(',').map((t) => t.trim()).filter(Boolean),
            imagem: doc.imagem || '',
            link: doc.site || doc.github || doc.link || '#',
            status: doc.status || 'Ativo',
            versao: doc.versao || ''
        };
    }

    function montarDadosParaFirestore(form) {
        const tecnologias = form.tech
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

        return {
            titulo: form.nome,
            descricao: form.descricao,
            status: form.status,
            versao: form.versao,
            tecnologias,
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
        const doc = cacheProjetos.find((p) => p.id === id);
        if (!doc) {
            UI.showAlert('Projeto não encontrado.', 'error');
            return;
        }

        const projeto = normalizeProjetoParaExibicao(doc);

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

    async function handleSubmit(e) {
        e.preventDefault();

        const formValues = {
            nome: document.getElementById('proj-nome').value.trim(),
            versao: document.getElementById('proj-versao').value.trim(),
            status: document.getElementById('proj-status').value,
            tech: document.getElementById('proj-tech').value.trim(),
            descricao: document.getElementById('proj-desc').value.trim(),
            imagem: document.getElementById('proj-imagem').value.trim(),
            link: document.getElementById('proj-link').value.trim() || '#'
        };

        if (!formValues.nome || !formValues.descricao) {
            UI.showAlert('Preencha o nome e a descrição do projeto.', 'error');
            return;
        }

        const dados = montarDadosParaFirestore(formValues);
        const submitButton = e.target.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        try {
            if (editingId) {
                await FirebaseStore.updateProjeto(editingId, dados);
                UI.showAlert('Projeto atualizado com sucesso!');
            } else {
                await FirebaseStore.addProjeto(dados);
                UI.showAlert('Projeto criado com sucesso!');
            }

            fecharModal();
            await renderTabela();
        } catch (erro) {
            console.error('Erro ao salvar projeto no Firestore:', erro);
            UI.showAlert('Erro ao salvar o projeto no Firestore. Veja o console.', 'error');
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
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

    async function confirmarExclusao() {
        if (!deleteTargetId) return;

        try {
            await FirebaseStore.deleteProjeto(deleteTargetId);
            UI.showAlert('Projeto excluído com sucesso!');
            fecharModalExclusao();
            await renderTabela();
        } catch (erro) {
            console.error('Erro ao excluir projeto no Firestore:', erro);
            UI.showAlert('Erro ao excluir o projeto no Firestore. Veja o console.', 'error');
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

    // Expõe função para o Assistente IA usar
    window.abrirModalNovo = abrirModalNovo;
})();