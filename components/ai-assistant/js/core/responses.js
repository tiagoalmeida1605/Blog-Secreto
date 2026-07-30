/**
 * responses.js - Gerador de respostas naturais a partir de dados estruturados
 *
 * Responsabilidades:
 * - Gerar respostas conversacionais naturais em português
 * - Personalidade consistente (amigável, técnica mas acessível)
 * - Variações de frases para evitar repetição
 * - Formatação de resultados (cards, listas, resumos)
 * - Tratamento de casos especiais (vazio, erro, contexto)
 */

import { SecurityManager } from '../core/SecurityManager.js';
import { ENTITY_TYPES } from './memory.js';

/**
 * Templates de resposta por tipo de intent
 */
const RESPONSE_TEMPLATES = {
    // Saudações
    greeting: {
        firstTime: [
            'Olá! 👋 Sou a assistente do Blog Secreto. Como posso te ajudar hoje?',
            'Oi! Bem-vindo ao Blog Secreto. Estou aqui pra te ajudar a explorar projetos, posts e muito mais.',
            'Olá! Tudo bem? Sou a IA local do Blog Secreto. O que você procura?'
        ],
        returning: [
            'Olá de novo! 👋 Em que posso ajudar hoje?',
            'Oi! Você voltou! Quer continuar de onde paramos ou buscar algo novo?',
            'E aí! Bom te ver por aqui novamente. O que procura?'
        ],
        byName: [
            'Olá, {name}! 👋 Como posso ajudar hoje?',
            'Oi, {name}! Bom te ver por aqui. O que você procura?',
            'E aí, {name}! Tudo certo?'
        ]
    },

    // Despedidas
    goodbye: [
        'Até mais! 👋 Foi bom conversar. Volte sempre!',
        'Tchau! Se precisar de algo, é só chamar.',
        'Até a próxima! O Blog Secreto te espera. 🌙',
        'Falou! Qualquer coisa, tô por aqui.'
    ],

    // Agradecimentos
    thanks: [
        'De nada! 😊 Se precisar de mais alguma coisa, é só falar.',
        'Por nada! Tô aqui pra ajudar.',
        'Disponha! Qualquer coisa, tô à disposição.',
        'Imagina! 🙌'
    ],

    // Sobre o blog
    about: [
        'O Blog Secreto é meu cantinho pra compartilhar projetos, experimentos e aprendizados sobre desenvolvimento, segurança, automação e tecnologia em geral. Tudo feito com carinho (e muito café) ☕',
        'Aqui no Blog Secreto eu documento minha jornada como dev: projetos open source, ferramentas que crio, tutoriais técnicos e reflexões sobre código. Fique à vontade pra explorar!'
    ],

    // Ajuda
    help: [
        'Posso te ajudar com várias coisas:\n\n• **Buscar projetos** por tecnologia, nome ou descrição\n• **Ver posts** e artigos recentes\n• **Explorar tags** e categorias\n• **Abrir páginas** (home, projetos, galeria, contato)\n• **Ver novidades** (changelog)\n• **Perguntas frequentes** (FAQ)\n\nExperimente dizer: "Mostrar projetos com React", "Últimos posts", "Abrir galeria" ou só "Ajuda".',
        'Aqui estão alguns comandos que entendo:\n\n🔍 **Busca**: "Projetos com Python", "Posts sobre Docker"\n📂 **Navegação**: "Abrir projetos", "Ir pra galeria", "Contato"\n📝 **Conteúdo**: "Últimos posts", "Tags populares", "Categorias"\n⚙️ **Sistema**: "Status", "Sobre", "Ajuda"\n\nE se você for admin, também tenho comandos especiais!'
    ],

    // Status do sistema
    system_status: [
        '🟢 **Sistema Online**\n\nTudo funcionando normalmente por aqui:\n• Firebase: Conectado\n• Cache local: Ativo\n• Busca local: Operacional\n• Sincronização: Tempo real',
        '✅ **Status: Saudável**\n\nServiços:\n☁️ Firebase Firestore: OK\n💾 LocalStorage: OK\n🔍 Motor de busca: OK\n⚡ Cache inteligente: Ativo'
    ],

    // Lista de projetos
    list_projects: {
        withResults: [
            'Encontrei **{count} projeto{plural}**{filter}:',
            'Aqui estão **{count} projeto{plural}**{filter}:',
            'Olha o que achei: **{count} projeto{plural}**{filter}:'
        ],
        empty: [
            'Não encontrei nenhum projeto{filter}. Que tal tentar outra busca?',
            'Nenhum projeto encontrado{filter}. Pode tentar termos diferentes?',
            'Hmm, nenhum projeto combina com isso{filter}. Quer que eu mostre todos?'
        ],
        single: [
            'Encontrei **1 projeto**{filter}:',
            'Achei **um projeto**{filter}:'
        ]
    },

    // Detalhes de projeto
    project_details: [
        'Aqui está o **{title}**:\n\n{description}\n\n**Tecnologias**: {techs}\n**Status**: {status}{version}\n\n{link}',
        '**{title}**\n\n{description}\n\n🛠 **Stack**: {techs}\n📦 **Status**: {status}{version}\n\n{link}'
    ],

    // Tecnologias do projeto
    project_technologies: {
        withResults: [
            'O projeto **{projectName}** usa:\n\n{techsList}',
            '**{projectName}** é construído com:\n\n{techsList}',
            'Stack do **{projectName}**:\n\n{techsList}'
        ],
        empty: [
            'O projeto **{projectName}** não tem tecnologias cadastradas.',
            'Não encontrei informações de stack para **{projectName}**.'
        ]
    },

    // Lista de posts
    list_posts: {
        withResults: [
            'Aqui estão **{count} post{plural}**{filter}:',
            'Encontrei **{count} post{plural}**{filter}:',
            'Últimos **{count} post{plural}**{filter}:'
        ],
        empty: [
            'Não encontrei posts{filter}.',
            'Nenhum post combina com sua busca{filter}.'
        ]
    },

    // Lista de tags
    list_tags: {
        withResults: [
            'Aqui estão **{count} tags** disponíveis:',
            'Tags do Blog Secreto (**{count}**):'
        ],
        empty: [
            'Nenhuma tag cadastrada ainda.'
        ]
    },

    // Lista de categorias
    list_categories: {
        withResults: [
            'Categorias disponíveis (**{count}**):',
            'Aqui estão as **{count} categorias**:'
        ],
        empty: [
            'Nenhuma categoria cadastrada.'
        ]
    },

    // Galeria
    gallery: {
        withResults: [
            'Aqui estão **{count} imagens** da galeria:',
            'Galeria do Blog Secreto (**{count}** imagens):'
        ],
        empty: [
            'A galeria está vazia por enquanto. 📸'
        ]
    },

    // Changelog
    changelog: {
        withResults: [
            'Aqui estão as **{count} últimas novidades**:',
            'Changelog recente (**{count}** entradas):'
        ],
        empty: [
            'Ainda não há changelog publicado.'
        ]
    },

    // FAQ
    faq: {
        withResults: [
            'Encontrei **{count} pergunta{plural}** frequente{plural}:',
            'Aqui está o que as pessoas costumam perguntar (**{count}**):'
        ],
        empty: [
            'Nenhuma FAQ cadastrada ainda.'
        ]
    },

    // Busca genérica
    search: {
        withResults: [
            'Encontrei **{count} resultado{plural}** para "{query}":',
            'Resultados para **"{query}"** ({count}):',
            'Achei **{count} coisa{plural}** sobre "{query}":'
        ],
        empty: [
            'Não encontrei nada para **"{query}"**. Tenta outros termos?',
            'Hmm, nada sobre **"{query}"**. Que tal "projetos", "posts" ou "tags"?'
        ]
    },

    // Erro
    error: {
        generic: [
            'Ops! Algo deu errado. 😅 Tenta de novo?',
            'Não consegui processar isso agora. Tenta mais tarde?',
            'Deu ruim aqui. Pode repetir?'
        ],
        offline: [
            'Parece que você está offline. 📡\n\nO Blog Secreto funciona offline para conteúdo já carregado, mas buscas novas precisam de conexão.',
            'Sem internet no momento. O cache local tem alguns dados - quer que eu mostre o que tenho salvo?'
        ],
        permission: [
            'Essa ação precisa de permissão de admin. 🔐\n\nFaça login no painel administrativo pra acessar.',
            'Acesso restrito! Só admins podem fazer isso. Entre no /admin se tiver credenciais.'
        ],
        notFound: [
            'Não encontrei o que você procura. 🔍\n\nTenta buscar de outro jeito ou me diz o que precisa.',
            'Esse conteúdo não existe ou foi movido. Quer que eu te ajude a achar algo parecido?'
        ]
    },

    // Confirmações
    confirmation: {
        understood: [
            'Entendido! ✨',
            'Combinado! 👍',
            'Ok, anotei! 📝'
        ],
        willHelp: [
            'Vou te ajudar com isso.',
            'Deixa comigo!',
            'Já tô resolvendo.'
        ]
    },

    // Transições contextuais
    transition: {
        related: [
            'Aliás, vi que você tem interesse em {topic}. Quer ver mais sobre isso?',
            'Já que você gostou de {topic}, posso te mostrar projetos relacionados.',
            'Por falar em {topic}, tenho mais algumas coisas legais pra mostrar.'
        ],
        followUp: [
            'Quer mais detalhes sobre algum desses?',
            'Posso te mostrar as tecnologias de algum projeto específico?',
            'Precisa de mais alguma coisa sobre isso?'
        ]
    }
};

/**
 * Variações de personalidade
 */
const PERSONALITY_VARIANTS = {
    friendly: 0.4,
    technical: 0.3,
    concise: 0.2,
    playful: 0.1
};

/**
 * ResponseGenerator - Gera respostas naturais
 */
export class ResponseGenerator {
    constructor(options = {}) {
        this.security = options.security || new SecurityManager();
        this.personality = options.personality || 'balanced'; // friendly, technical, concise, playful, balanced
        this.random = Math.random;
    }

    /**
     * Gera resposta para intent reconhecida
     */
    generate(intent, data = {}, context = {}) {
        const { visitorName, lastIntent, isAdmin, conversationLength = 0 } = context;

        switch (intent) {
            case 'greeting':
                return this._generateGreeting(visitorName, conversationLength);

            case 'goodbye':
                return this._pickRandom(RESPONSE_TEMPLATES.goodbye);

            case 'thanks':
                return this._pickRandom(RESPONSE_TEMPLATES.thanks);

            case 'about':
                return this._pickRandom(RESPONSE_TEMPLATES.about);

            case 'help':
                return this._pickRandom(RESPONSE_TEMPLATES.help);

            case 'system_status':
                return this._pickRandom(RESPONSE_TEMPLATES.system_status);

            case 'list_projects':
                return this._generateListResponse(
                    data.projects || [],
                    RESPONSE_TEMPLATES.list_projects,
                    data.filterDescription
                );

            case 'project_details':
                return this._generateProjectDetails(data.project);

            case 'project_technologies':
                return this._generateProjectTechnologies(data.project, data.technologies);

            case 'list_posts':
                return this._generateListResponse(
                    data.posts || [],
                    RESPONSE_TEMPLATES.list_posts,
                    data.filterDescription
                );

            case 'list_tags':
                return this._generateTagsResponse(data.tags || []);

            case 'list_categories':
                return this._generateCategoriesResponse(data.categories || []);

            case 'gallery':
                return this._generateListResponse(
                    data.images || [],
                    RESPONSE_TEMPLATES.gallery,
                    data.filterDescription
                );

            case 'changelog':
                return this._generateListResponse(
                    data.entries || [],
                    RESPONSE_TEMPLATES.changelog,
                    data.filterDescription
                );

            case 'faq':
                return this._generateFAQResponse(data.faq || []);

            case 'search':
                return this._generateSearchResponse(data.query, data.results || []);

            case 'open_page':
                return this._generateOpenPageResponse(data.target, data.success);

            case 'admin_action':
                return this._generateAdminActionResponse(data.action, data.success, data.message);

            case 'developer_dashboard':
                return this._generateDevDashboardResponse(data);

            default:
                return this._generateSearchResponse(data.query || '', data.results || []);
        }
    }

    // ==================== GERADORES ESPECÍFICOS ====================

    _generateGreeting(visitorName, conversationLength) {
        if (visitorName) {
            const template = this._pickRandom(RESPONSE_TEMPLATES.greeting.byName);
            return template.replace('{name}', visitorName);
        }

        if (conversationLength === 0) {
            return this._pickRandom(RESPONSE_TEMPLATES.greeting.firstTime);
        }

        return this._pickRandom(RESPONSE_TEMPLATES.greeting.returning);
    }

    _generateListResponse(items, templates, filterDescription = '') {
        const count = items.length;
        const plural = count !== 1 ? 's' : '';
        const filterText = filterDescription ? ` ${filterDescription}` : '';

        if (count === 0) {
            const template = this._pickRandom(templates.empty);
            return template
                .replace('{filter}', filterText)
                .replace('{plural}', plural);
        }

        const template = count === 1 && templates.single
            ? this._pickRandom(templates.single)
            : this._pickRandom(templates.withResults);

        let response = template
            .replace('{count}', count)
            .replace('{plural}', plural)
            .replace('{filter}', filterText);

        // Adiciona preview dos itens se houver
        if (count > 0 && items[0]?.title) {
            const preview = items.slice(0, 3).map((item, i) =>
                `${i + 1}. **${this.security.sanitize(item.title)}**${item.description ? ` - ${this.security.sanitize(item.description.substring(0, 80))}...` : ''}`
            ).join('\n');

            response += '\n\n' + preview;

            if (count > 3) {
                response += `\n\n*...e mais ${count - 3} ${count - 3 === 1 ? 'item' : 'itens'}*`;
            }
        }

        return response;
    }

    _generateProjectDetails(project) {
        if (!project) {
            return this._pickRandom(RESPONSE_TEMPLATES.error.notFound);
        }

        const techs = (project.tecnologias || project.tags || []).join(', ') || 'Não informadas';
        const status = project.status || 'Ativo';
        const version = project.versao ? ` (v${project.versao})` : '';
        const link = project.link && project.link !== '#'
            ? `\n🔗 [Abrir projeto](${project.link})`
            : '';

        const template = this._pickRandom(RESPONSE_TEMPLATES.project_details);
        return template
            .replace('{title}', this.security.sanitize(project.nome || project.title || 'Sem título'))
            .replace('{description}', this.security.sanitize(project.descricao || project.description || 'Sem descrição'))
            .replace('{techs}', techs)
            .replace('{status}', status)
            .replace('{version}', version)
            .replace('{link}', link);
    }

    _generateProjectTechnologies(project, technologies) {
        if (!project) {
            return this._pickRandom(RESPONSE_TEMPLATES.error.notFound);
        }

        const techs = technologies || project.tecnologias || project.tags || [];

        if (techs.length === 0) {
            const template = this._pickRandom(RESPONSE_TEMPLATES.project_technologies.empty);
            return template.replace('{projectName}', this.security.sanitize(project.nome || project.title));
        }

        const techsList = techs.map((t, i) =>
            `${i + 1}. **${this.security.sanitize(typeof t === 'string' ? t : t.nome || t.name || 'Tech')}**`
        ).join('\n');

        const template = this._pickRandom(RESPONSE_TEMPLATES.project_technologies.withResults);
        return template
            .replace('{projectName}', this.security.sanitize(project.nome || project.title))
            .replace('{techsList}', techsList);
    }

    _generateTagsResponse(tags) {
        const count = tags.length;
        const plural = count !== 1 ? 's' : '';

        if (count === 0) {
            return this._pickRandom(RESPONSE_TEMPLATES.list_tags.empty);
        }

        const template = this._pickRandom(RESPONSE_TEMPLATES.list_tags.withResults);
        let response = template.replace('{count}', count).replace('{plural}', plural);

        // Agrupa por categoria se disponível
        const categorized = {};
        tags.forEach(tag => {
            const cat = tag.categoria || tag.category || 'Geral';
            if (!categorized[cat]) categorized[cat] = [];
            categorized[cat].push(tag);
        });

        Object.entries(categorized).forEach(([cat, catTags]) => {
            response += `\n\n**${this.security.sanitize(cat)}**`;
            catTags.slice(0, 10).forEach(tag => {
                const countTag = tag.count ? ` (${tag.count})` : '';
                response += `\n• ${this.security.sanitize(tag.nome || tag.name)}${countTag}`;
            });
            if (catTags.length > 10) {
                response += `\n*...e mais ${catTags.length - 10} tags*`;
            }
        });

        return response;
    }

    _generateCategoriesResponse(categories) {
        const count = categories.length;
        const plural = count !== 1 ? 's' : '';

        if (count === 0) {
            return this._pickRandom(RESPONSE_TEMPLATES.list_categories.empty);
        }

        const template = this._pickRandom(RESPONSE_TEMPLATES.list_categories.withResults);
        let response = template.replace('{count}', count).replace('{plural}', plural);

        categories.forEach(cat => {
            const countCat = cat.count ? ` (${cat.count})` : '';
            response += `\n• **${this.security.sanitize(cat.nome || cat.name)}**${countCat}`;
            if (cat.descricao || cat.description) {
                response += ` - ${this.security.sanitize((cat.descricao || cat.description).substring(0, 60))}...`;
            }
        });

        return response;
    }

    _generateFAQResponse(faqItems) {
        const count = faqItems.length;
        const plural = count !== 1 ? 's' : '';

        if (count === 0) {
            return this._pickRandom(RESPONSE_TEMPLATES.faq.empty);
        }

        const template = this._pickRandom(RESPONSE_TEMPLATES.faq.withResults);
        let response = template.replace('{count}', count).replace('{plural}', plural);

        faqItems.slice(0, 5).forEach((item, i) => {
            response += `\n\n**${i + 1}. ${this.security.sanitize(item.pergunta || item.question)}**`;
            response += `\n${this.security.sanitize((item.resposta || item.answer).substring(0, 200))}...`;
        });

        if (count > 5) {
            response += `\n\n*...e mais ${count - 5} perguntas*`;
        }

        return response;
    }

    _generateSearchResponse(query, results) {
        const count = results.length;
        const plural = count !== 1 ? 's' : '';
        const safeQuery = this.security.sanitize(query);

        if (count === 0) {
            const template = this._pickRandom(RESPONSE_TEMPLATES.search.empty);
            return template.replace('{query}', safeQuery);
        }

        const template = this._pickRandom(RESPONSE_TEMPLATES.search.withResults);
        let response = template.replace('{count}', count).replace('{plural}', plural).replace('{query}', safeQuery);

        // Agrupa por tipo
        const byType = {};
        results.forEach(r => {
            const type = r.type || r.source || 'result';
            if (!byType[type]) byType[type] = [];
            byType[type].push(r);
        });

        Object.entries(byType).forEach(([type, items]) => {
            const typeLabel = this._getTypeLabel(type);
            response += `\n\n**${typeLabel}** (${items.length})`;
            items.slice(0, 3).forEach(item => {
                response += `\n• **${this.security.sanitize(item.title)}**${item.description ? ` - ${this.security.sanitize(item.description.substring(0, 60))}...` : ''}`;
            });
            if (items.length > 3) {
                response += `\n*...e mais ${items.length - 3}*`;
            }
        });

        return response;
    }

    _generateOpenPageResponse(target, success) {
        const pages = {
            home: 'início',
            projetos: 'projetos',
            galeria: 'galeria',
            contato: 'contato',
            dashboard: 'painel admin'
        };

        const pageName = pages[target] || target;

        if (success) {
            return `Abrindo **${pageName}**... 🔗`;
        }

        return `Não consegui abrir **${pageName}**. A página pode não existir ou você precisa de permissão.`;
    }

    _generateAdminActionResponse(action, success, message) {
        const actions = {
            new_project: 'criar projeto',
            new_post: 'criar post',
            edit_gallery_image: 'editar imagem da galeria',
            open_logs: 'ver logs',
            open_github: 'ver GitHub',
            open_settings: 'abrir configurações'
        };

        const actionName = actions[action] || action;

        if (success) {
            return `✅ **${actionName}** realizado com sucesso!${message ? `\n\n${message}` : ''}`;
        }

        return `❌ Não consegui **${actionName}**.${message ? `\n\n${message}` : ' Tenta de novo?'}`;
    }

    _generateDevDashboardResponse(data) {
        return `🛠 **Developer Dashboard**\n\n${data.summary || 'Painel de desenvolvedor ativo.'}\n\n${data.details || ''}`;
    }

    // ==================== FORMATAÇÃO DE RESULTADOS PARA UI ====================

    /**
     * Converte resultados em formato para MessageRenderer
     */
    formatResultsForUI(results, intent) {
        return (results || []).slice(0, 6).map(item => ({
            id: item.id || this.security.createId('res'),
            type: item.type || item.source || 'content',
            typeLabel: this._getTypeLabel(item.type || item.source || 'content'),
            title: this.security.sanitize(item.title || item.nome || item.titulo || 'Sem título'),
            description: this.security.sanitize(
                item.description ||
                item.descricao ||
                item.resposta ||
                item.answer ||
                'Sem descrição'
            ).substring(0, 200),
            href: item.href || item.link || item.path || `#${item.id}`,
            tags: (item.tags || item.tecnologias || []).slice(0, 5).map(t =>
                this.security.sanitize(typeof t === 'string' ? t : t.nome || t.name || t)
            ),
            score: item.score || 0,
            raw: item
        }));
    }

    /**
     * Gera ações rápidas contextuais baseadas na resposta
     */
    generateQuickActions(intent, data = {}, context = {}) {
        const actions = [];
        const { isAdmin, visitorName } = context;

        switch (intent) {
            case 'list_projects':
                if (data.projects?.length) {
                    data.projects.slice(0, 3).forEach(p => {
                        actions.push({
                            type: 'navigate',
                            label: `Abrir ${p.nome || p.title}`,
                            href: p.link || `#projeto-${p.id}`,
                            payload: { projectId: p.id }
                        });
                        if (p.tecnologias?.length) {
                            actions.push({
                                type: 'search',
                                label: `🛠 Tec: ${p.nome || p.title}`,
                                payload: { query: `tecnologias do ${p.nome || p.title}` }
                            });
                        }
                    });
                }
                actions.push({ type: 'search', label: '🔍 Buscar outros', payload: { query: 'projetos' } });
                break;

            case 'project_details':
            case 'project_technologies':
                if (data.project) {
                    actions.push({
                        type: 'search',
                        label: '🛠 Ver tecnologias',
                        payload: { query: `tecnologias do ${data.project.nome || data.project.title}` }
                    });
                    actions.push({
                        type: 'search',
                        label: '🔗 Projetos relacionados',
                        payload: { query: `projetos parecidos com ${data.project.nome || data.project.title}` }
                    });
                    if (data.project.link && data.project.link !== '#') {
                        actions.push({
                            type: 'navigate',
                            label: '🔗 Abrir projeto',
                            href: data.project.link
                        });
                    }
                }
                break;

            case 'list_posts':
                if (data.posts?.length) {
                    data.posts.slice(0, 3).forEach(p => {
                        actions.push({
                            type: 'navigate',
                            label: `Ler: ${p.titulo || p.title}`,
                            href: p.link || `/post/${p.slug || p.id}`,
                            payload: { postId: p.id }
                        });
                    });
                }
                actions.push({ type: 'search', label: '📝 Ver todos posts', payload: { query: 'posts' } });
                break;

            case 'list_tags':
                actions.push({ type: 'search', label: '🏷️ Buscar por tag', payload: { query: 'tag:' } });
                break;

            case 'list_categories':
                actions.push({ type: 'search', label: '📂 Buscar por categoria', payload: { query: 'categoria:' } });
                break;

            case 'search':
                if (data.results?.length) {
                    // Ações baseadas no tipo de resultado mais comum
                    const types = [...new Set(data.results.map(r => r.type).filter(Boolean))];
                    types.slice(0, 2).forEach(type => {
                        actions.push({
                            type: 'search',
                            label: `Ver mais ${this._getTypeLabel(type, true)}`,
                            payload: { query: `tipo:${type}` }
                        });
                    });
                }
                break;

            case 'admin_action':
                if (isAdmin) {
                    actions.push(
                        { type: 'admin_new_project', label: '➕ Novo Projeto' },
                        { type: 'search', label: '📝 Novo Post', payload: { query: 'novo post' } },
                        { type: 'open_dev_dashboard', label: '⚙️ Dev Dashboard' }
                    );
                }
                break;

            default:
                // Ações genéricas úteis
                actions.push(
                    { type: 'search', label: '🔍 Projetos', payload: { query: 'projetos' } },
                    { type: 'search', label: '📝 Posts', payload: { query: 'posts' } },
                    { type: 'search', label: '🏷️ Tags', payload: { query: 'tags' } }
                );
        }

        // Adiciona ação de voltar se tem histórico
        if (context.conversationLength > 1) {
            actions.push({ type: 'search', label: '↩️ Voltar', payload: { query: 'anterior' } });
        }

        return actions.slice(0, 6);
    }

    // ==================== UTILITÁRIOS ====================

    _getTypeLabel(type, plural = false) {
        const labels = {
            project: plural ? 'Projetos' : 'Projeto',
            post: plural ? 'Posts' : 'Post',
            tag: plural ? 'Tags' : 'Tag',
            category: plural ? 'Categorias' : 'Categoria',
            faq: plural ? 'Perguntas' : 'Pergunta',
            gallery: plural ? 'Imagens' : 'Imagem',
            changelog: plural ? 'Novidades' : 'Novidade',
            content: plural ? 'Conteúdos' : 'Conteúdo',
            result: plural ? 'Resultados' : 'Resultado'
        };
        return labels[type] || (plural ? 'Itens' : 'Item');
    }

    _pickRandom(array) {
        if (!array || !array.length) return '';
        return array[Math.floor(this.random() * array.length)];
    }

    /**
     * Aplica variação de personalidade
     */
    applyPersonality(text, personality = this.personality) {
        // Em versões futuras, pode aplicar transformações baseadas na personalidade
        return text;
    }
}

// Instância singleton
export const responseGenerator = new ResponseGenerator();