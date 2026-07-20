/**
 * ==========================================================================
 * View: Gerenciamento de Projetos (CRUD Completo + Filtros + Modais)
 * ==========================================================================
 */

// Estado interno da página
let idProjetoEmEdicao = null;
let idProjetoParaExcluir = null;

// Elementos do DOM
const tabela = document.getElementById('tabela-projetos');
const form = document.getElementById('form-projeto');
const inputBusca = document.getElementById('input-busca');
const selectFiltroStatus = document.getElementById('filtro-status');
const modalTitulo = document.getElementById('modal-titulo');

function escapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeUrl(url, fallback = '#') {
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

// ==========================================
// RENDERIZAÇÃO DA TABELA E FILTROS
// ==========================================

function renderizarTabela() {
    if (!tabela) return;

    tabela.innerHTML = '';
    let projetos = Store.getProjetos();

    // Aplica Filtro de Busca por Texto
    const termoBusca = inputBusca ? inputBusca.value.toLowerCase() : '';
    if (termoBusca) {
        projetos = projetos.filter(p =>
            p.nome.toLowerCase().includes(termoBusca) ||
            p.descricao.toLowerCase().includes(termoBusca) ||
            p.tecnologias.some(t => t.toLowerCase().includes(termoBusca))
        );
    }

    // Aplica Filtro por Status
    const statusFiltro = selectFiltroStatus ? selectFiltroStatus.value : 'todos';
    if (statusFiltro !== 'todos') {
        projetos = projetos.filter(p => p.status.toLowerCase() === statusFiltro.toLowerCase());
    }

    // Se não encontrar nada
    if (projetos.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">
                    Nenhum projeto encontrado.
                </td>
            </tr>`;
        return;
    }

    // Monta as linhas
    projetos.forEach(proj => {
        const tr = document.createElement('tr');

        // Trata a lista de tecnologias para virar badges
        const techBadges = Array.isArray(proj.tecnologias)
            ? proj.tecnologias.map(t => `<span class="tech-badge" style="font-size:11px; padding:2px 8px; background:var(--bg-panel); border:1px solid var(--border); border-radius:12px; margin-right:4px;">${escapeHTML(t)}</span>`).join('')
            : '';
        const imageUrl = safeUrl(proj.imagem || 'https://via.placeholder.com/40', 'https://via.placeholder.com/40');

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${imageUrl}" alt="" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid var(--border);">
                    <div>
                        <strong>${escapeHTML(proj.nome)}</strong>
                        <div style="margin-top: 4px;">${techBadges}</div>
                    </div>
                </div>
            </td>
            <td><span style="color: ${proj.status === 'Ativo' ? '#2ecc71' : proj.status === 'Em Teste' ? 'var(--accent)' : 'var(--text-muted)'}; font-weight: 600;">${escapeHTML(proj.status)}</span></td>
            <td><code>${escapeHTML(proj.versao)}</code></td>
            <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted); font-size: 0.85rem;">${escapeHTML(proj.descricao)}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;" onclick="abrirModalEdicao(${proj.id})">Editar</button>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="abrirModalExclusao(${proj.id})">Excluir</button>
                </div>
            </td>
        `;
        tabela.appendChild(tr);
    });
}

// Eventos de Filtro em Tempo Real
if (inputBusca) inputBusca.addEventListener('input', renderizarTabela);
if (selectFiltroStatus) selectFiltroStatus.addEventListener('change', renderizarTabela);

// ==========================================
// MODAL DE ADICIONAR / EDITAR
// ==========================================

function abrirModalNovo() {
    idProjetoEmEdicao = null;
    form.reset();
    if (modalTitulo) modalTitulo.textContent = 'Novo Projeto';
    UI.openModal('modal-projeto');
}

function abrirModalEdicao(id) {
    const proj = Store.getProjetoById(id);
    if (!proj) return;

    idProjetoEmEdicao = id;
    if (modalTitulo) modalTitulo.textContent = 'Editar Projeto';

    // Preenche os campos do formulário
    document.getElementById('proj-nome').value = proj.nome || '';
    document.getElementById('proj-desc').value = proj.descricao || '';
    document.getElementById('proj-tech').value = Array.isArray(proj.tecnologias) ? proj.tecnologias.join(', ') : '';
    document.getElementById('proj-status').value = proj.status || 'Ativo';
    document.getElementById('proj-versao').value = proj.versao || '';
    document.getElementById('proj-imagem').value = proj.imagem || '';
    document.getElementById('proj-link').value = proj.link || '';

    UI.openModal('modal-projeto');
}

function fecharModalForm() {
    UI.closeModal('modal-projeto');
    form.reset();
    idProjetoEmEdicao = null;
}

// Submit do Formulário (Salvar / Criar / Atualizar)
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const tecnologiasInput = document.getElementById('proj-tech').value;
        const arrayTechs = tecnologiasInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

        const dadosProjeto = {
            nome: document.getElementById('proj-nome').value,
            descricao: document.getElementById('proj-desc').value,
            tecnologias: arrayTechs,
            status: document.getElementById('proj-status').value,
            versao: document.getElementById('proj-versao').value,
            imagem: document.getElementById('proj-imagem').value || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
            link: document.getElementById('proj-link').value || '#'
        };

        if (idProjetoEmEdicao) {
            // Atualizar
            Store.updateProjeto(idProjetoEmEdicao, dadosProjeto);
            UI.showAlert('Projeto atualizado com sucesso!');
        } else {
            // Criar
            Store.addProjeto(dadosProjeto);
            UI.showAlert('Novo projeto cadastrado com sucesso!');
        }

        renderizarTabela();
        fecharModalForm();
    });
}

// ==========================================
// MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
// ==========================================

function abrirModalExclusao(id) {
    idProjetoParaExcluir = id;
    UI.openModal('modal-confirmar-exclusao');
}

function fecharModalExclusao() {
    idProjetoParaExcluir = null;
    UI.closeModal('modal-confirmar-exclusao');
}

function confirmarExclusao() {
    if (idProjetoParaExcluir) {
        Store.deleteProjeto(idProjetoParaExcluir);
        renderizarTabela();
        UI.showAlert('Registro excluído do banco.', 'danger');
        fecharModalExclusao();
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    renderizarTabela();
});
