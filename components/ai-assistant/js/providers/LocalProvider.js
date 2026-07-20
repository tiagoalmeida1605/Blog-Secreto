import { AIProvider } from './AIProvider.js';
import { ApiService } from '../services/ApiService.js';
import { SearchEngine } from '../core/SearchEngine.js';
import { IntentRecognizer } from '../core/IntentRecognizer.js';
import { SecurityManager } from '../core/SecurityManager.js';

export class LocalSearchProvider extends AIProvider {
    constructor({
        apiService = new ApiService(),
        searchEngine = new SearchEngine(),
        intentRecognizer = new IntentRecognizer()
    } = {}) {
        super({ id: 'local', label: 'Busca local' });
        this.api = apiService;
        this.searchEngine = searchEngine;
        this.intentRecognizer = intentRecognizer;
    }

    async generate(rawMessage, context = {}) {
        const message = SecurityManager.sanitize(rawMessage);
        const intent = this.intentRecognizer.recognize(message, context);

        if (intent.requiresAdmin && !context.isAdmin) {
            return this.normalizeResponse({
                text: 'Esse assunto é restrito ao administrador autenticado. No modo público eu posso ajudar com posts, projetos, categorias, tags, páginas e conteúdos publicados.',
                meta: { intent: intent.name, blocked: true }
            });
        }

        switch (intent.name) {
            case 'help':
                return this.help(context);
            case 'about':
                return this.about();
            case 'system_status':
                return this.status(context);
            case 'developer_dashboard':
                return this.developerDashboard(context);
            case 'matrix':
                return this.matrix();
            case 'admin_action':
                return this.adminAction(intent, context);
            case 'open_page':
                return this.openPage(intent, context);
            case 'list_projects':
                return this.projects(intent, context, message);
            case 'list_posts':
                return this.posts(context);
            case 'list_categories':
                return this.categories(context);
            case 'list_tags':
                return this.tags(context);
            case 'gallery':
                return this.gallery(context);
            case 'changelog':
                return this.changelog(context);
            case 'search':
            default:
                return this.search(message, intent, context);
        }
    }

    help(context = {}) {
        const publicLines = [
            'Posso pesquisar conteúdos públicos, listar projetos, mostrar categorias e tags, abrir páginas e sugerir materiais relacionados.',
            'Comandos disponíveis: /help, /about, /status e /matrix.'
        ];

        const adminLines = [
            'No painel administrativo também posso abrir módulos, mostrar status interno, logs, APIs preparadas e o Developer Dashboard.',
            'Comandos administrativos: /dev, /status, "criar novo projeto", "abrir logs" e "status GitHub".'
        ];

        return this.normalizeResponse({
            text: context.isAdmin ? [...publicLines, ...adminLines].join('\n') : publicLines.join('\n'),
            meta: { intent: 'help' }
        });
    }

    about() {
        return this.normalizeResponse({
            text: 'O Blog Secreto é um laboratório web para testar ideias, criar projetos e evoluir conteúdos. Eu sou o Assistente IA: hoje respondo com busca local nos dados do site e já estou preparado para receber provedores de IA reais sem mudar a interface.',
            meta: { intent: 'about' }
        });
    }

    async status(context = {}) {
        if (!context.isAdmin) {
            const projects = await this.api.getProjects();
            const posts = await this.api.getPosts();

            return this.normalizeResponse({
                text: `Status público: assistente online em modo local. Conteúdos disponíveis agora: ${projects.length} projeto(s), ${posts.length} post(s) cadastrado(s) e páginas públicas do Blog Secreto.`,
                meta: { intent: 'status' }
            });
        }

        const snapshot = await this.api.getAdminSnapshot();

        return this.normalizeResponse({
            text: [
                `Status administrativo: ${snapshot.system.server}.`,
                `Projetos: ${snapshot.counts.projects}. Posts: ${snapshot.counts.posts}. Imagens: ${snapshot.counts.images}.`,
                `Banco: ${snapshot.system.database}. API: ${snapshot.system.api}. Armazenamento: ${snapshot.system.storage}.`,
                `Memória: ${snapshot.system.memory}. CPU: ${snapshot.system.cpu}. Uptime: ${snapshot.system.uptime}.`
            ].join('\n'),
            meta: { intent: 'status', snapshot }
        });
    }

    developerDashboard(context = {}) {
        if (!context.isAdmin) {
            return this.normalizeResponse({
                text: 'O Developer Dashboard só fica disponível no painel administrativo com sessão ativa.',
                meta: { blocked: true }
            });
        }

        return this.normalizeResponse({
            text: 'Developer Dashboard aberto com estatísticas, status, GitHub preparado e logs filtráveis.',
            meta: { openDeveloperDashboard: true, intent: 'developer_dashboard' }
        });
    }

    matrix() {
        return this.normalizeResponse({
            text: 'Modo matrix ativado por alguns segundos.',
            meta: { matrix: true, intent: 'matrix' }
        });
    }

    adminAction(intent, context = {}) {
        if (!context.isAdmin) {
            return this.normalizeResponse({
                text: 'Essa ação exige autenticação administrativa.',
                meta: { blocked: true }
            });
        }

        const action = intent.entities.action;

        if (action === 'new_project') {
            return this.normalizeResponse({
                text: 'Vou abrir o módulo de projetos no modo de criação.',
                actions: [{ label: 'Abrir novo projeto', type: 'admin_new_project', href: '/admin/projetos.html?assistantAction=newProject' }],
                meta: { autoExecuteAction: 'admin_new_project', intent: 'admin_action' }
            });
        }

        if (action === 'new_post') {
            return this.normalizeResponse({
                text: 'O módulo de posts ainda não existe neste projeto. A intenção foi reconhecida e a rota pode ser conectada quando a área de posts for criada.',
                meta: { intent: 'admin_action', pendingModule: 'posts' }
            });
        }

        if (action === 'edit_gallery_image') {
            return this.normalizeResponse({
                text: `A galeria administrativa ainda não está implementada. Quando o módulo existir, esta intenção já poderá carregar a imagem ${intent.entities.imageId || 'informada'} em modo de edição.`,
                meta: { intent: 'admin_action', pendingModule: 'gallery' }
            });
        }

        if (action === 'open_logs') {
            return this.normalizeResponse({
                text: 'Abrindo logs no Developer Dashboard.',
                actions: [{ label: 'Abrir logs', type: 'open_dev_dashboard', href: '#developer-dashboard' }],
                meta: { openDeveloperDashboard: true, intent: 'admin_action' }
            });
        }

        if (action === 'open_github') {
            return this.normalizeResponse({
                text: 'A seção GitHub está no Developer Dashboard. A integração real ainda precisa do backend ou token seguro.',
                actions: [{ label: 'Abrir GitHub', type: 'open_dev_dashboard', href: '#developer-dashboard' }],
                meta: { openDeveloperDashboard: true, intent: 'admin_action' }
            });
        }

        if (action === 'open_settings') {
            return this.normalizeResponse({
                text: 'Vou abrir as configurações do painel.',
                actions: [{ label: 'Abrir configurações', type: 'navigate', href: '/admin/configuracoes.html' }],
                meta: { autoExecuteAction: 'navigate', intent: 'admin_action' }
            });
        }

        return this.normalizeResponse({
            text: 'Ação administrativa reconhecida, mas ainda não existe um executor conectado para ela.',
            meta: { intent: 'admin_action' }
        });
    }

    openPage(intent, context = {}) {
        const target = intent.entities.target;
        const publicRoutes = {
            home: '/index.html',
            projetos: '/pages/projetos.html',
            contato: '/pages/contato.html'
        };

        if (target === 'galeria') {
            return this.normalizeResponse({
                text: 'A galeria pública ainda não possui uma página própria. Posso mostrar as imagens associadas aos projetos.',
                meta: { intent: 'open_page' }
            });
        }

        if (target === 'dashboard' && !context.isAdmin) {
            return this.normalizeResponse({
                text: 'O painel administrativo não aparece para visitantes. Faça login para acessar funções administrativas.',
                meta: { blocked: true }
            });
        }

        const href = target === 'dashboard' ? '/admin/index.html' : publicRoutes[target] || '/index.html';

        return this.normalizeResponse({
            text: `Abrindo ${target === 'home' ? 'a página inicial' : target}.`,
            actions: [{ label: 'Abrir página', type: 'navigate', href }],
            meta: { autoExecuteAction: 'navigate', intent: 'open_page' }
        });
    }

    async projects(intent, context = {}, message = '') {
        const projects = await this.api.getProjects();
        let filtered = [...projects];
        const technology = intent.entities.technology;
        const status = intent.entities.status;

        if (intent.contextual && context.memory && context.memory.lastResults.length) {
            filtered = context.memory.lastResults.map((item) => item.source || item);
        }

        if (technology) {
            filtered = filtered.filter((project) => (project.tecnologias || [])
                .some((tag) => SecurityManager.normalizeForSearch(tag).includes(technology)));
        }

        if (status) {
            filtered = filtered.filter((project) => SecurityManager.normalizeForSearch(project.status) === status);
        }

        if (!filtered.length) {
            return this.normalizeResponse({
                text: `Não encontrei projetos com esse filtro nos dados disponíveis.`,
                results: [],
                meta: { intent: 'list_projects' }
            });
        }

        const results = filtered.map((project) => this.projectToResult(project));
        const intro = technology
            ? `Encontrei ${filtered.length} projeto(s) relacionado(s) a ${technology}:`
            : `Encontrei ${filtered.length} projeto(s) no Blog Secreto:`;

        return this.normalizeResponse({
            text: `${intro}\n${this.formatProjectLines(filtered)}\n\nPosso filtrar por tecnologia, status ou abrir a página de projetos.`,
            results,
            actions: [{ label: 'Abrir projetos', type: 'navigate', href: '/pages/projetos.html' }],
            meta: { intent: 'list_projects', query: message }
        });
    }

    async posts() {
        const posts = await this.api.getPosts();

        if (!posts.length) {
            return this.normalizeResponse({
                text: 'Ainda não há posts cadastrados nos dados locais do Blog Secreto. Quando a área de posts for criada, eu passarei a pesquisar esses artigos automaticamente.',
                meta: { intent: 'list_posts' }
            });
        }

        return this.normalizeResponse({
            text: `Encontrei ${posts.length} post(s) cadastrado(s).`,
            results: posts.map((post) => ({
                id: post.id,
                type: 'post',
                title: post.title || post.titulo,
                description: post.description || post.resumo || '',
                href: post.href || '#',
                tags: post.tags || []
            })),
            meta: { intent: 'list_posts' }
        });
    }

    async categories(context = {}) {
        const categories = await this.api.getCategories();

        return this.normalizeResponse({
            text: `Categorias disponíveis: ${categories.map((category) => category.title).join(', ')}.`,
            results: categories,
            meta: { intent: 'list_categories', context: context.isAdmin ? 'admin' : 'public' }
        });
    }

    async tags() {
        const tags = await this.api.getTags();

        if (!tags.length) {
            return this.normalizeResponse({
                text: 'Ainda não há tags cadastradas.',
                meta: { intent: 'list_tags' }
            });
        }

        return this.normalizeResponse({
            text: `Tags encontradas: ${tags.map((tag) => tag.title).join(', ')}.`,
            results: tags,
            meta: { intent: 'list_tags' }
        });
    }

    async gallery() {
        const gallery = await this.api.getGallery();

        if (!gallery.length) {
            return this.normalizeResponse({
                text: 'Ainda não há imagens publicadas na galeria local.',
                meta: { intent: 'gallery' }
            });
        }

        return this.normalizeResponse({
            text: `Encontrei ${gallery.length} imagem(ns) associada(s) aos projetos publicados.`,
            results: gallery,
            actions: [{ label: 'Abrir projetos', type: 'navigate', href: '/pages/projetos.html' }],
            meta: { intent: 'gallery' }
        });
    }

    async changelog(context = {}) {
        const changelog = await this.api.getChangelog();
        const publicEntries = context.isAdmin
            ? changelog
            : changelog.filter((entry) => !entry.adminOnly);

        return this.normalizeResponse({
            text: `Novidades registradas: ${publicEntries.length}.`,
            results: publicEntries.map((entry) => ({
                id: entry.id,
                type: 'changelog',
                title: entry.title,
                description: entry.description,
                href: '#',
                tags: entry.tags || []
            })),
            meta: { intent: 'changelog' }
        });
    }

    async search(message, intent, context = {}) {
        const data = await this.api.getSearchIndex({ isAdmin: context.isAdmin });
        const contextItems = intent.contextual && context.memory ? context.memory.lastResults : [];
        const searchResult = this.searchEngine.search(message, data, {
            includeAdmin: context.isAdmin,
            contextItems,
            limit: 8
        });

        if (!searchResult.results.length) {
            return this.normalizeResponse({
                text: 'Não encontrei essa informação nos dados disponíveis do Blog Secreto. Posso tentar pesquisar por projetos, categorias, tags ou páginas específicas.',
                results: [],
                meta: { intent: 'search', query: message }
            });
        }

        return this.normalizeResponse({
            text: this.composeSearchAnswer(searchResult, intent, context),
            results: searchResult.results,
            meta: { intent: 'search', query: message }
        });
    }

    composeSearchAnswer(searchResult, intent, context = {}) {
        const top = searchResult.results[0];
        const contextNote = intent.contextual ? 'Usando o contexto da conversa anterior, ' : '';
        const related = searchResult.results
            .slice(1, 4)
            .map((item) => item.title)
            .join(', ');

        const lines = [
            `${contextNote}encontrei ${searchResult.total} resultado(s).`,
            `Principal resultado: ${top.title}. ${top.description || 'Sem descrição cadastrada.'}`
        ];

        if (related) {
            lines.push(`Relacionados: ${related}.`);
        }

        if (!context.isAdmin && SecurityManager.isAdminOnlyTopic(searchResult.query)) {
            lines.push('Detalhes internos continuam restritos ao administrador.');
        }

        return lines.join('\n');
    }

    formatProjectLines(projects) {
        return projects
            .slice(0, 5)
            .map((project) => {
                const tech = Array.isArray(project.tecnologias) ? project.tecnologias.join(', ') : 'sem tecnologias cadastradas';
                return `- ${project.nome}: ${project.descricao} Tecnologias: ${tech}. Status: ${project.status}.`;
            })
            .join('\n');
    }

    projectToResult(project) {
        return {
            id: project.id,
            type: 'project',
            title: project.nome,
            description: project.descricao,
            href: project.link && project.link !== '#' ? project.link : '/pages/projetos.html',
            tags: project.tecnologias || [],
            source: project
        };
    }
}
