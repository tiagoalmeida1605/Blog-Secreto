// ... (mantenha a parte superior do arquivo intacta até chegar em createProjectRow)

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

// ... (O restante do arquivo projetos.js permanece igual)