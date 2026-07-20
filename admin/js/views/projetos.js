// Simulação de Banco de Dados Local (Pronto para virar chamadas Fetch/API)
let dbProjetos = [
    { id: 1, nome: "Sistema Nexus", status: "Ativo", versao: "v1.2.0" },
    { id: 2, nome: "Cryptos API", status: "Em Teste", versao: "v0.8.5-beta" }
];

const tabela = document.getElementById('tabela-projetos');
const modal = document.getElementById('modal-projeto');
const form = document.getElementById('form-projeto');

// Read (GET)
function renderizarTabela() {
    tabela.innerHTML = '';
    dbProjetos.forEach(proj => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${proj.nome}</strong></td>
            <td><span style="color: var(--accent);">${proj.status}</span></td>
            <td>${proj.versao}</td>
            <td style="display: flex; gap: 8px;">
                <button class="btn btn-outline" onclick="editarProjeto(${proj.id})">Editar</button>
                <button class="btn btn-danger" onclick="excluirProjeto(${proj.id})">Excluir</button>
            </td>
        `;
        tabela.appendChild(tr);
    });
}

// Modal Control
function abrirModal() { modal.classList.add('active'); form.reset(); }
function fecharModal() { modal.classList.remove('active'); }

// Create & Update (POST/PUT)
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('proj-nome').value;
    const status = document.getElementById('proj-status').value;
    const versao = document.getElementById('proj-versao').value;

    // Lógica simples de "Add" (para escalar, adicionar lógica de "Update" com ID)
    const novoProjeto = {
        id: Date.now(),
        nome, status, versao
    };

    dbProjetos.push(novoProjeto);
    renderizarTabela();
    fecharModal();
});

// Delete (DELETE)
function excluirProjeto(id) {
    if(confirm("Confirmar expurgo do registro?")) {
        dbProjetos = dbProjetos.filter(p => p.id !== id);
        renderizarTabela();
    }
}

function editarProjeto(id) {
    alert("Função de edição em construção. Preparando endpoints.");
}

// Initialize
renderizarTabela();