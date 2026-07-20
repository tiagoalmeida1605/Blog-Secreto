/**
 * ==========================================================================
 * Script Público: Exibição dos Projetos (pages/projetos.html)
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('grid-projetos-publicos');

    if (!grid) return;

    // Busca os projetos salvos pelo Admin no localStorage
    const dadosLocais = localStorage.getItem('secreto_admin_projetos');

    if (!dadosLocais) {
        grid.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center;">Nenhum registro de projeto encontrado no dossiê.</p>`;
        return;
    }

    const projetos = JSON.parse(dadosLocais);

    if (projetos.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center;">Nenhum projeto ativo no momento.</p>`;
        return;
    }

    grid.innerHTML = '';

    // Renderiza cada projeto usando as classes do seu pages.css
    projetos.forEach(proj => {
        const article = document.createElement('article');
        article.className = 'project-card';

        // Formata as badges de tecnologia
        const badgesHtml = Array.isArray(proj.tecnologias)
            ? proj.tecnologias.map(tech => `<span class="tech-badge">${tech}</span>`).join('')
            : '';

        const btnText = proj.link && proj.link !== '#' ? 'Acessar Projeto' : 'Ver Repositório';

        article.innerHTML = `
            <img src="${proj.imagem}" alt="${proj.nome}" class="project-image" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80'">
            
            <div class="project-meta">
                <span>Status: ${proj.status}</span>
                <span>${proj.versao}</span>
            </div>
            
            <h3 class="project-title">${proj.nome}</h3>
            <p class="project-desc">${proj.descricao}</p>
            
            <div class="project-tech">
                ${badgesHtml}
            </div>
            
            <button><a href="${proj.link || '#'}" target="_blank" rel="noopener noreferrer">${btnText}</a></button>
        `;

        grid.appendChild(article);
    });
});