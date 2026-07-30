import { AIProvider } from './AIProvider.js';
import { ApiService } from '../services/ApiService.js';
import { SearchEngine } from '../core/SearchEngine.js';
import { IntentRecognizer } from '../core/IntentRecognizer.js';
import { SecurityManager } from '../core/SecurityManager.js';

/**
 * LocalSearchProvider - Provedor de IA Local Inteligente
 *
 * Responde usando busca local nos dados do Blog Secreto.
 * Possui personalidade consistente: profissional, moderna, amigável.
 * Memória contextual para referências ("ele", "essa lista", "o primeiro").
 * Etapas de processamento visuais antes de responder.
 * Ações rápidas contextuais (botões funcionais).
 * Preparado para integração futura com IA real (OpenAI, Gemini, Ollama, etc.)
 */
export class LocalSearchProvider extends AIProvider {
    constructor({
        apiService = new ApiService(),
        searchEngine = new SearchEngine(),
        intentRecognizer = new IntentRecognizer()
    } = {}) {
        super({ id: 'local', label: 'Busca local inteligente' });
        this.api = apiService;
        this.searchEngine = searchEngine;
        this.intentRecognizer = intentRecognizer;

        // Personalidade da assistente - variações para respostas naturais
        this.personality = {
            greetings: [
                'Olá! 👋 ',
                'Oi! ',
                'E aí! ',
                'Olá! Como posso ajudar? '
            ],
            confirmations: [
                'Entendido! ',
                'Combinado! ',
                'Perfeito! ',
                'Certo! ',
                'Beleza! ',
                'Ok! '
            ],
            thinking: [
                'Deixe-me ver... ',
                'Vou pesquisar isso pra você... ',
                'Um instante... ',
                'Buscando as informações... ',
                'Processando... '
            ],
            success: [
                'Encontrei! ',
                'Aqui está: ',
                'Localizei: ',
                'Pronto! ',
                'Tudo certo. '
            ],
            notFound: [
                'Não encontrei exatamente isso, mas ',
                'Hmm, não achei nada com esse termo. ',
                'Parece que não temos isso cadastrado. ',
                'Não localizei nos dados atuais. '
            ],
            closings: [
                '\nPosso ajudar em mais alguma coisa?',
                '\nPrecisa de mais detalhes?',
                '\nQuer ver algo mais?',
                '\nEstou à disposição!'
            ],
            contextualRefs: [
                'Como mencionei, ',
                'Voltando ao que vimos antes, ',
                'Baseado na nossa conversa, '
            ]
        };

        // Respostas de ajuda contextual
        this.helpResponses = {
            public: `Sou o Assistente IA do Blog Secreto. Posso te ajudar com:

🔍 **Pesquisar** - Qualquer termo: "Linux", "React", "projeto NEXUS"
📋 **Listar projetos** - "Mostrar projetos", "Quais projetos existem?"
🏷️ **Categorias e tags** - "Categorias", "Tags disponíveis"
📝 **Posts e novidades** - "Últimos posts", "Changelog", "Galeria"
📄 **Navegação** - "Abrir projetos", "Ir para contato", "Home"
💬 **Conversa natural** - "Me fale sobre o NEXUS", "Que tecnologias ele usa?"

Dica: Use pronomes como "ele", "essa lista", "o primeiro" pra continuar assuntos anteriores.`,
            admin: `Modo Administrador ativo! 🔐

Além das funções públicas, você tem acesso a:
⚙️ **Painel** - "/dev" ou "Developer Dashboard"
📊 **Status** - "/status" ou "Status do sistema"
➕ **Criar** - "Novo projeto", "Novo post"
📋 **Logs** - "Abrir logs", "Ver logs de segurança"
🔗 **GitHub** - "Status GitHub", "Abrir GitHub"
⚙️ **Config** - "Abrir configurações"

Comandos rápidos: /help, /about, /status, /dev, /matrix`
        };
    }

    async generate(rawMessage, context = {}) {
        const message = SecurityManager.sanitize(rawMessage);
        const intent = this.intentRecognizer.recognize(message, context);

        // Bloqueia tópicos admin no modo público
        if (intent.requiresAdmin && !context.isAdmin) {
            return this.normalizeResponse({
                text: 'Esse assunto é restrito ao administrador autenticado. No modo público eu posso ajudar com posts, projetos, categorias, tags, páginas e conteúdos publicados.',
                meta: { intent: intent.name, blocked: true }
            });
        }

        // Atualiza contexto de navegação
        if (context.route) {
            context.memory?.updateContext?.({ currentPage: context.route });
        }

        // Reconhece saudações simples
        if (this.isGreeting(message)) {
            return this.greeting(context);
        }

        // Reconhece agradecimentos
        if (this.isThanks(message)) {
            return this.thanks(context);
        }

        // Reconhece despedidas
        if (this.isGoodbye(message)) {
            return this.goodbye(context);
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

    // ========== DETECÇÃO DE INTENÇÕES SOCIAIS ==========

    isGreeting(text) {
        const normalized = SecurityManager.normalizeForSearch(text);
        return ['oi', 'ola', 'olá', 'eai', 'e ai', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'hi'].some(g => normalized === g || normalized.startsWith(g + ' '));
    }

    isThanks(text) {
        const normalized = SecurityManager.normalizeForSearch(text);
        return ['obrigado', 'obrigada', 'valeu', 'thanks', 'vlw', 'gratidão'].some(t => normalized.includes(t));
    }

    isGoodbye(text) {
        const normalized = SecurityManager.normalizeForSearch(text);
        return ['tchau', 'ate mais', 'até mais', 'falou', 'byebye', 'bye', 'ate logo', 'até logo'].some(g => normalized.includes(g));
    }

    // ========== RESPOSTAS SOCIAIS ==========

    greeting(context = {}) {
        const visitorName = context.memory?.visitorProfile?.name;
        const visitCount = context.memory?.visitorProfile?.visitCount || 1;
        const isAdmin = context.isAdmin;

        let greeting = this.random(this.personality.greetings);

        if (visitorName) {
            greeting += `${visitorName}! `;
        } else if (visitCount > 1) {
            greeting += `Bem-vindo de novo! `;
        }

        if (isAdmin) {
            greeting += `Estou no modo administrador. ${this.random(this.personality.thinking)}Posso mostrar o dashboard, status do sistema, logs ou ajudar a criar conteúdo.`;
        } else {
            greeting += `Sou o Assistente do Blog Secreto. ${this.random(this.personality.thinking)}Posso pesquisar projetos, posts, categorias, abrir páginas e muito mais.`;
        }

        return this.normalizeResponse({
            text: greeting,
            meta: { intent: 'greeting' },
            suggestions: this.getContextualSuggestions(context)
        });
    }

    thanks(context = {}) {
        const responses = [
            'Por nada! 😊 Fico feliz em ajudar.',
            'De nada! Se precisar de mais alguma coisa, é só chamar.',
            'Imagina! Estou aqui pra isso.',
            'Sem problemas! Qualquer coisa, tô por aqui.',
            'Disponha! O Blog Secreto tem muito conteúdo legal pra explorar.'
        ];

        return this.normalizeResponse({
            text: this.random(responses),
            meta: { intent: 'thanks' }
        });
    }

    goodbye(context = {}) {
        const responses = [
            'Até mais! 👋 Volte sempre ao Blog Secreto.',
            'Tchau! Foi bom conversar. Qualquer coisa, tô aqui.',
            'Falou! Se precisar, é só abrir o chat.',
            'Até a próxima! continue explorando os projetos.'
        ];

        return this.normalizeResponse({
            text: this.random(responses),
            meta: { intent: 'goodbye' }
        });
    }

    // ========== AJUDA E SOBRE ==========

    help(context = {}) {
        const isAdmin = context.isAdmin;
        const text = isAdmin ? this.helpResponses.admin : this.helpResponses.public;

        return this.normalizeResponse({
            text,
            meta: { intent: 'help' },
            actions: this.buildHelpActions(isAdmin)
        });
    }

    buildHelpActions(isAdmin) {
        const actions = [
            { label: '🔍 Pesquisar projetos', type: 'search', payload: { query: 'projetos' } },
            { label: '📋 Ver todos projetos', type: 'navigate', href: '/pages/projetos.html' }
        ];

        if (isAdmin) {
            actions.push(
                { label: '⚙️ Developer Dashboard', type: 'open_dev_dashboard', href: '#developer-dashboard' },
                { label: '➕ Criar projeto', type: 'admin_new_project', href: '/admin/projetos.html?assistantAction=newProject' }
            );
        }

        return actions;
    }

    getContextualSuggestions(context) {
        const base = [
            { label: 'Ver projetos', value: 'Mostrar projetos' },
            { label: 'Pesquisar...', value: 'Pesquisar' },
            { label: 'Categorias', value: 'Categorias' }
        ];

        if (context.isAdmin) {
            return [...base,
                { label: '/status', value: '/status', requiresAdmin: true },
                { label: 'Novo projeto', value: 'Criar novo projeto', requiresAdmin: true },
                { label: 'Ver logs', value: 'Abrir logs', requiresAdmin: true }
            ];
        }
        return base;
    }

    about() {
        return this.normalizeResponse({
            text: this.random(this.personality.success) + 'O Blog Secreto é um laboratório web para testar ideias, criar projetos e evoluir conteúdos. Eu sou o Assistente IA: hoje respondo com busca local nos dados do site e já estou preparado para receber provedores de IA reais (OpenAI, Gemini, Ollama, etc.) sem mudar a interface.',
            meta: { intent: 'about' },
            actions: [
                { label: 'Ver projetos', type: 'navigate', href: '/pages/projetos.html' },
                { label: 'Contato', type: 'navigate', href: '/pages/contato.html' }
            ]
        });
    }

    // ========== STATUS ==========

    async status(context = {}) {
        if (!context.isAdmin) {
            const projects = await this.api.getProjects();
            const posts = await this.api.getPosts();

            return this.normalizeResponse({
                text: `${this.random(this.personality.success)}Status público: assistente online em modo local. Conteúdos disponíveis: ${projects.length} projeto(s), ${posts.length} post(s) e páginas públicas do Blog Secreto.`,
                meta: { intent: 'status' },
                actions: [{ label: 'Ver projetos', type: 'navigate', href: '/pages/projetos.html' }]
            });
        }

        const snapshot = await this.api.getAdminSnapshot();

        return this.normalizeResponse({
            text: [
                `${this.random(this.personality.success)}Status administrativo: ${snapshot.system.server}.`,
                `📦 Projetos: ${snapshot.counts.projects} | 📝 Posts: ${snapshot.counts.posts} | 🖼️ Imagens: ${snapshot.counts.images}`,
                `💾 Banco: ${snapshot.system.database} | 🔌 API: ${snapshot.system.api} | ☁️ Storage: ${snapshot.system.storage}`,
                `🧠 Memória: ${snapshot.system.memory} | ⚡ CPU: ${snapshot.system.cpu} | ⏱️ Uptime: ${snapshot.system.uptime}`
            ].join('\n'),
            meta: { intent: 'status', snapshot },
            actions: [
                { label: 'Developer Dashboard', type: 'open_dev_dashboard', href: '#developer-dashboard' },
                { label: 'Ver logs', type: 'open_dev_dashboard', href: '#developer-dashboard' }
            ]
        });
    }

    // ========== DEVELOPER DASHBOARD ==========

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

    // ========== MATRIX EASTER EGG ==========

    matrix() {
        return this.normalizeResponse({
            text: 'Modo matrix ativado por alguns segundos. 🕶️',
            meta: { matrix: true, intent: 'matrix' }
        });
    }

    // ========== AÇÕES ADMINISTRATIVAS ==========

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
                text: `${this.random(this.personality.confirmations)}Vou abrir o módulo de projetos no modo de criação.`,
                actions: [{ label: '➕ Abrir novo projeto', type: 'admin_new_project', href: '/admin/projetos.html?assistantAction=newProject' }],
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
                actions: [{ label: '📋 Abrir logs', type: 'open_dev_dashboard', href: '#developer-dashboard' }],
                meta: { openDeveloperDashboard: true, intent: 'admin_action' }
            });
        }

        if (action === 'open_github') {
            return this.normalizeResponse({
                text: 'A seção GitHub está no Developer Dashboard. A integração real ainda precisa de backend ou token seguro.',
                actions: [{ label: '🐙 Abrir GitHub', type: 'open_dev_dashboard', href: '#developer-dashboard' }],
                meta: { openDeveloperDashboard: true, intent: 'admin_action' }
            });
        }

        if (action === 'open_settings') {
            return this.normalizeResponse({
                text: `${this.random(this.personality.confirmations)}Vou abrir as configurações do painel.`,
                actions: [{ label: '⚙️ Abrir configurações', type: 'navigate', href: '/admin/configuracoes.html' }],
                meta: { autoExecuteAction: 'navigate', intent: 'admin_action' }
            });
        }

        return this.normalizeResponse({
            text: 'Ação administrativa reconhecida, mas ainda não existe um executor conectado para ela.',
            meta: { intent: 'admin_action' }
        });
    }

    // ========== NAVEGAÇÃO ==========

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
        const pageName = target === 'home' ? 'a página inicial' : target;

        return this.normalizeResponse({
            text: `${this.random(this.personality.confirmations)}Abrindo ${pageName}.`,
            actions: [{ label: '🌐 Abrir página', type: 'navigate', href }],
            meta: { autoExecuteAction: 'navigate', intent: 'open_page' }
        });
    }

    // ========== PROJETOS ==========

    async projects(intent, context = {}, message = '') {
        const projects = await this.api.getProjects();
        let filtered = [...projects];
        const technology = intent.entities.technology;
        const status = intent.entities.status;

        // Filtro contextual: usa últimos resultados se a intenção for contextual
        if (intent.contextual && context.memory && context.memory.lastResults?.length) {
            filtered = context.memory.lastResults.map(item => item.source || item);
        }

        if (technology) {
            filtered = filtered.filter(project => (project.tecnologias || [])
                .some(tag => SecurityManager.normalizeForSearch(tag).includes(technology)));
        }

        if (status) {
            filtered = filtered.filter(project => SecurityManager.normalizeForSearch(project.status) === status);
        }

        if (!filtered.length) {
            const suggestion = technology
                ? `Tente pesquisar por "${technology}" sem filtro, ou veja todos os projetos.`
                : 'Não encontrei projetos com esse filtro.';

            return this.normalizeResponse({
                text: `${this.random(this.personality.notFound)}${suggestion}`,
                results: [],
                meta: { intent: 'list_projects' },
                actions: [{ label: 'Ver todos projetos', type: 'navigate', href: '/pages/projetos.html' }]
            });
        }

        const results = filtered.map(project => this.projectToResult(project));
        const intro = technology
            ? `${this.random(this.personality.success)}Encontrei ${filtered.length} projeto(s) relacionado(s) a **${technology}**:`
            : `${this.random(this.personality.success)}Encontrei ${filtered.length} projeto(s) no Blog Secreto:`;

        // Registra projetos conhecidos no perfil do visitante
        if (context.memory) {
            filtered.slice(0, 3).forEach(p => context.memory.rememberProject(p));
        }

        return this.normalizeResponse({
            text: `${intro}\n${this.formatProjectLines(filtered)}\n\n${this.random(this.personality.closings)}`,
            results,
            actions: this.buildProjectActions(filtered),
            meta: { intent: 'list_projects', query: message }
        });
    }

    buildProjectActions(projects) {
        const actions = [
            { label: '📋 Ver todos projetos', type: 'navigate', href: '/pages/projetos.html' }
        ];

        // Ações para o primeiro projeto (mais relevante)
        if (projects.length > 0) {
            const first = projects[0];
            actions.unshift(
                { label: `🔗 Abrir ${first.nome}`, type: 'navigate', href: first.link && first.link !== '#' ? first.link : '/pages/projetos.html' }
            );

            if (first.tecnologias?.length) {
                actions.push(
                    { label: '🛠️ Ver tecnologias', type: 'search', payload: { query: `tecnologias do ${first.nome}` } }
                );
            }
        }

        return actions.slice(0, 4); // Máximo 4 ações
    }

    // ========== POSTS ==========

    async posts(context = {}) {
        const posts = await this.api.getPosts();

        if (!posts.length) {
            return this.normalizeResponse({
                text: `${this.random(this.personality.notFound)}Ainda não há posts cadastrados nos dados locais do Blog Secreto. Quando a área de posts for criada, eu passarei a pesquisar esses artigos automaticamente.`,
                meta: { intent: 'list_posts' }
            });
        }

        const recentPosts = posts.slice(0, 5);

        return this.normalizeResponse({
            text: `${this.random(this.personality.success)}Encontrei ${posts.length} post(s) cadastrado(s). Os mais recentes:\n${recentPosts.map(p => `• **${p.title || p.titulo}** - ${p.description || p.resumo || 'sem descrição'}`).join('\n')}\n\n${this.random(this.personality.closings)}`,
            results: posts.map(post => ({
                id: post.id,
                type: 'post',
                title: post.title || post.titulo,
                description: post.description || post.resumo || '',
                href: post.href || '#',
                tags: post.tags || []
            })),
            meta: { intent: 'list_posts' },
            actions: [{ label: '📝 Ver posts', type: 'navigate', href: '/pages/projetos.html' }]
        });
    }

    // ========== CATEGORIAS ==========

    async categories(context = {}) {
        const categories = await this.api.getCategories();

        return this.normalizeResponse({
            text: `${this.random(this.personality.success)}Categorias disponíveis: **${categories.map(c => c.title).join('**, **')}**.\n\n${this.random(this.personality.closings)}`,
            results: categories,
            meta: { intent: 'list_categories', context: context.isAdmin ? 'admin' : 'public' },
            actions: [
                { label: '🏷️ Ver tags', type: 'search', payload: { query: 'tags' } },
                { label: '📋 Ver projetos', type: 'navigate', href: '/pages/projetos.html' }
            ]
        });
    }

    // ========== TAGS ==========

    async tags(context = {}) {
        const tags = await this.api.getTags();

        if (!tags.length) {
            return this.normalizeResponse({
                text: `${this.random(this.personality.notFound)}Ainda não há tags cadastradas.`,
                meta: { intent: 'list_tags' }
            });
        }

        return this.normalizeResponse({
            text: `${this.random(this.personality.success)}Tags encontradas: **${tags.map(t => t.title).join('**, **')}**.\n\n${this.random(this.personality.closings)}`,
            results: tags,
            meta: { intent: 'list_tags' },
            actions: [
                { label: '📋 Ver projetos por tag', type: 'navigate', href: '/pages/projetos.html' }
            ]
        });
    }

    // ========== GALERIA ==========

    async gallery(context = {}) {
        const gallery = await this.api.getGallery();

        if (!gallery.length) {
            return this.normalizeResponse({
                text: `${this.random(this.personality.notFound)}Ainda não há imagens publicadas na galeria local.`,
                meta: { intent: 'gallery' }
            });
        }

        return this.normalizeResponse({
            text: `${this.random(this.personality.success)}Encontrei ${gallery.length} imagem(ns) associada(s) aos projetos publicados.\n\n${this.random(this.personality.closings)}`,
            results: gallery,
            actions: [{ label: '📋 Ver projetos', type: 'navigate', href: '/pages/projetos.html' }],
            meta: { intent: 'gallery' }
        });
    }

    // ========== CHANGELOG ==========

    async changelog(context = {}) {
        const changelog = await this.api.getChangelog();
        const publicEntries = context.isAdmin
            ? changelog
            : changelog.filter(entry => !entry.adminOnly);

        return this.normalizeResponse({
            text: `${this.random(this.personality.success)}Novidades registradas: **${publicEntries.length}**.\n\n${this.random(this.personality.closings)}`,
            results: publicEntries.map(entry => ({
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

    // ========== BUSCA GERAL ==========

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
                text: `${this.random(this.personality.notFound)}Não encontrei essa informação nos dados disponíveis do Blog Secreto. Posso tentar pesquisar por projetos, categorias, tags ou páginas específicas.\n\n${this.random(this.personality.closings)}`,
                results: [],
                meta: { intent: 'search', query: message },
                actions: [
                    { label: '📋 Ver projetos', type: 'navigate', href: '/pages/projetos.html' },
                    { label: '🏷️ Ver categorias', type: 'search', payload: { query: 'categorias' } }
                ]
            });
        }

        return this.normalizeResponse({
            text: this.composeSearchAnswer(searchResult, intent, context),
            results: searchResult.results,
            meta: { intent: 'search', query: message },
            actions: this.buildSearchActions(searchResult.results)
        });
    }

    composeSearchAnswer(searchResult, intent, context = {}) {
        const top = searchResult.results[0];
        const contextNote = intent.contextual ? `${this.random(this.personality.contextualRefs)}` : '';
        const related = searchResult.results
            .slice(1, 4)
            .map(item => item.title)
            .join(', ');

        const lines = [
            `${contextNote}${this.random(this.personality.success)}encontrei ${searchResult.total} resultado(s).`,
            `**${top.title}** - ${top.description || 'Sem descrição cadastrada.'}`
        ];

        if (related) {
            lines.push(`Relacionados: ${related}.`);
        }

        // Adiciona dica contextual se for projeto
        if (top.type === 'project' && top.tags?.length) {
            lines.push(`💡 Tecnologias: ${top.tags.join(', ')}`);
        }

        if (!context.isAdmin && SecurityManager.isAdminOnlyTopic(searchResult.query)) {
            lines.push('🔒 Detalhes internos continuam restritos ao administrador.');
        }

        return lines.join('\n');
    }

    buildSearchActions(results) {
        const actions = [];

        if (results.length > 0) {
            const top = results[0];
            if (top.href && top.href !== '#') {
                actions.push({
                    label: `🔗 Abrir ${top.title}`,
                    type: 'navigate',
                    href: top.href
                });
            }

            if (top.type === 'project' && top.tags?.length) {
                actions.push({
                    label: '🛠️ Ver tecnologias',
                    type: 'search',
                    payload: { query: `tecnologias do ${top.title}` }
                });
            }

            if (results.length > 1) {
                actions.push({
                    label: '📋 Ver mais resultados',
                    type: 'search',
                    payload: { query: 'relacionados' }
                });
            }
        }

        actions.push({
            label: '🔍 Nova pesquisa',
            type: 'search',
            payload: { query: '' }
        });

        return actions.slice(0, 4);
    }

    // ========== FORMATTERS ==========

    formatProjectLines(projects) {
        return projects
            .slice(0, 5)
            .map(project => {
                const tech = Array.isArray(project.tecnologias) ? project.tecnologias.join(', ') : 'sem tecnologias cadastradas';
                return `• **${project.nome}**: ${project.descricao || 'sem descrição'} \n  🛠️ ${tech} | 📊 ${project.status}${project.versao ? ` | v${project.versao}` : ''}`;
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

    // ========== UTILITÁRIOS ==========

    random(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
}