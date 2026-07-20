import { SecurityManager } from './SecurityManager.js';

export class DeveloperMode {
    constructor({ apiService, storageManager }) {
        this.api = apiService;
        this.storage = storageManager;
        this.filters = {
            category: 'ALL',
            date: '',
            user: '',
            query: ''
        };
    }

    async render(container) {
        const snapshot = await this.api.getAdminSnapshot();
        const fragment = document.createDocumentFragment();

        fragment.append(
            this.createMetrics(snapshot),
            this.createStatus(snapshot),
            this.createGithub(snapshot),
            this.createEndpoints(snapshot),
            this.createLogs(snapshot, container)
        );

        return fragment;
    }

    createMetrics(snapshot) {
        const section = this.createSection('Resumo');
        const grid = document.createElement('div');
        grid.className = 'ai-dev-grid';

        const metrics = [
            ['Versão', snapshot.version],
            ['Posts', snapshot.counts.posts],
            ['Projetos', snapshot.counts.projects],
            ['Imagens', snapshot.counts.images],
            ['Comentários', snapshot.counts.comments],
            ['Curtidas', snapshot.counts.likes],
            ['Usuários online', snapshot.counts.onlineUsers],
            ['Logs', snapshot.counts.logs]
        ];

        metrics.forEach(([label, value]) => grid.appendChild(this.createMetric(label, value)));
        section.appendChild(grid);
        return section;
    }

    createStatus(snapshot) {
        const section = this.createSection('Sistema');
        const list = document.createElement('dl');
        list.className = 'ai-dev-list';

        Object.entries(snapshot.system).forEach(([key, value]) => {
            const term = document.createElement('dt');
            term.textContent = this.labelize(key);
            const detail = document.createElement('dd');
            detail.textContent = String(value);
            list.append(term, detail);
        });

        section.appendChild(list);
        return section;
    }

    createGithub(snapshot) {
        const section = this.createSection('GitHub');
        const list = document.createElement('dl');
        list.className = 'ai-dev-list';

        Object.entries(snapshot.github).forEach(([key, value]) => {
            const term = document.createElement('dt');
            term.textContent = this.labelize(key);
            const detail = document.createElement('dd');
            detail.textContent = String(value);
            list.append(term, detail);
        });

        section.appendChild(list);
        return section;
    }

    createEndpoints(snapshot) {
        const section = this.createSection('APIs preparadas');
        const list = document.createElement('ul');
        list.className = 'ai-dev-endpoints';

        Object.entries(snapshot.endpoints).forEach(([method, path]) => {
            const item = document.createElement('li');
            const code = document.createElement('code');
            code.textContent = `${method === 'chat' ? 'POST' : 'GET'} ${path}`;
            item.appendChild(code);
            list.appendChild(item);
        });

        section.appendChild(list);
        return section;
    }

    createLogs(snapshot, container) {
        const section = this.createSection('Logs');
        const filters = document.createElement('form');
        filters.className = 'ai-log-filters';
        filters.addEventListener('submit', (event) => event.preventDefault());

        const category = this.createSelect('category', ['ALL', 'INFO', 'WARNING', 'ERROR', 'SECURITY']);
        const date = this.createInput('date', 'date', 'Data');
        const user = this.createInput('user', 'search', 'Usuário');
        const query = this.createInput('query', 'search', 'Pesquisar');

        filters.append(category, date, user, query);
        section.appendChild(filters);

        const list = document.createElement('div');
        list.className = 'ai-log-list';
        section.appendChild(list);

        const updateLogs = () => {
            this.filters.category = category.value;
            this.filters.date = date.value;
            this.filters.user = user.value;
            this.filters.query = query.value;
            this.renderLogs(list, snapshot.logs);
        };

        filters.addEventListener('input', updateLogs);
        filters.addEventListener('change', updateLogs);
        this.renderLogs(list, snapshot.logs);

        return section;
    }

    renderLogs(list, logs) {
        list.replaceChildren();
        const filtered = this.filterLogs(logs);

        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'ai-dev-empty';
            empty.textContent = 'Nenhum log encontrado com os filtros atuais.';
            list.appendChild(empty);
            return;
        }

        filtered.slice(0, 30).forEach((log) => {
            const item = document.createElement('article');
            item.className = `ai-log-item ai-log-item--${SecurityManager.normalizeForSearch(log.category)}`;

            const header = document.createElement('div');
            const category = document.createElement('strong');
            category.textContent = log.category;
            const date = document.createElement('time');
            date.dateTime = log.date;
            date.textContent = new Date(log.date).toLocaleString('pt-BR');
            header.append(category, date);

            const message = document.createElement('p');
            message.textContent = log.message;

            const meta = document.createElement('span');
            meta.textContent = `Usuário: ${log.user}${log.query ? ` | Pesquisa: ${log.query}` : ''}`;

            item.append(header, message, meta);
            list.appendChild(item);
        });
    }

    filterLogs(logs) {
        return logs.filter((log) => {
            const sameCategory = this.filters.category === 'ALL' || log.category === this.filters.category;
            const sameDate = !this.filters.date || String(log.date || '').startsWith(this.filters.date);
            const sameUser = !this.filters.user || SecurityManager.normalizeForSearch(log.user).includes(SecurityManager.normalizeForSearch(this.filters.user));
            const sameQuery = !this.filters.query ||
                SecurityManager.normalizeForSearch(`${log.message} ${log.query}`).includes(SecurityManager.normalizeForSearch(this.filters.query));

            return sameCategory && sameDate && sameUser && sameQuery;
        });
    }

    createSection(title) {
        const section = document.createElement('section');
        section.className = 'ai-dev-section';
        const heading = document.createElement('h3');
        heading.textContent = title;
        section.appendChild(heading);
        return section;
    }

    createMetric(label, value) {
        const card = document.createElement('div');
        card.className = 'ai-dev-metric';

        const valueNode = document.createElement('strong');
        valueNode.textContent = String(value);
        const labelNode = document.createElement('span');
        labelNode.textContent = label;

        card.append(valueNode, labelNode);
        return card;
    }

    createSelect(name, options) {
        const select = document.createElement('select');
        select.name = name;
        select.value = this.filters[name] || options[0];
        select.setAttribute('aria-label', `Filtro ${name}`);

        options.forEach((option) => {
            const node = document.createElement('option');
            node.value = option;
            node.textContent = option;
            select.appendChild(node);
        });

        return select;
    }

    createInput(name, type, placeholder) {
        const input = document.createElement('input');
        input.name = name;
        input.type = type;
        input.placeholder = placeholder;
        input.value = this.filters[name] || '';
        input.setAttribute('aria-label', placeholder);
        return input;
    }

    labelize(key) {
        const labels = {
            storage: 'Armazenamento',
            memory: 'Memória',
            cpu: 'CPU',
            uptime: 'Uptime',
            server: 'Servidor',
            database: 'Banco de dados',
            cache: 'Cache',
            api: 'APIs',
            auth: 'Sessão',
            status: 'Status',
            lastCommit: 'Último commit',
            branch: 'Branch',
            stars: 'Estrelas',
            forks: 'Forks',
            languages: 'Linguagens',
            repositories: 'Repositórios',
            updatedAt: 'Última atualização'
        };

        return labels[key] || key;
    }
}
