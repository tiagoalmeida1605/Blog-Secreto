import { SecurityManager } from './SecurityManager.js';

export class IntentRecognizer {
    recognize(rawText, context = {}) {
        const original = String(rawText || '').trim();
        const text = SecurityManager.normalizeForSearch(original);

        if (!text) {
            return { name: 'empty', confidence: 1, entities: {} };
        }

        if (original.startsWith('/')) {
            return this.recognizeCommand(original);
        }

        const adminAction = this.recognizeAdminAction(text);
        if (adminAction) return adminAction;

        if (this.matchesAny(text, ['status do sistema', 'status', 'servidor online', 'apis online'])) {
            return { name: 'system_status', confidence: 0.95, entities: {}, requiresAdmin: SecurityManager.isAdminOnlyTopic(text) };
        }

        if (this.matchesAny(text, ['ajuda', 'comandos', 'o que voce faz', 'como usar'])) {
            return { name: 'help', confidence: 0.95, entities: {} };
        }

        if (this.matchesAny(text, ['sobre', 'blog secreto', 'quem e voce'])) {
            return { name: 'about', confidence: 0.8, entities: {} };
        }

        if (this.matchesAny(text, ['abrir', 'va para', 'ir para', 'mostrar pagina'])) {
            return this.recognizeOpenIntent(text);
        }

        if (this.matchesAny(text, ['projeto', 'projetos'])) {
            return {
                name: 'list_projects',
                confidence: 0.9,
                entities: {
                    technology: this.extractTechnology(text),
                    status: this.extractStatus(text)
                },
                contextual: this.isContextual(text, context)
            };
        }

        if (this.matchesAny(text, ['post', 'posts', 'artigo', 'artigos', 'ultimos'])) {
            return { name: 'list_posts', confidence: 0.85, entities: {} };
        }

        // Detecta solicitação de tecnologias de projeto específico
        if (this.matchesAny(text, ['tecnologias do', 'tecnologia do', 'stack do', 'usa o que', 'que tecnologias'])) {
            return {
                name: 'search',
                confidence: 0.9,
                entities: {
                    query: original,
                    technology: this.extractTechnology(text),
                    intentType: 'project_technologies'
                },
                contextual: this.isContextual(text, context)
            };
        }

        if (this.matchesAny(text, ['categoria', 'categorias'])) {
            return { name: 'list_categories', confidence: 0.85, entities: {} };
        }

        if (this.matchesAny(text, ['tag', 'tags', 'tecnologia', 'tecnologias'])) {
            return { name: 'list_tags', confidence: 0.85, entities: {} };
        }

        if (this.matchesAny(text, ['galeria', 'imagem', 'imagens', 'foto', 'fotos'])) {
            return { name: 'gallery', confidence: 0.85, entities: {} };
        }

        if (this.matchesAny(text, ['novidade', 'novidades', 'changelog', 'mudancas', 'atualizacoes'])) {
            return { name: 'changelog', confidence: 0.85, entities: {}, requiresAdmin: text.includes('admin') };
        }

        return {
            name: 'search',
            confidence: 0.7,
            entities: {
                query: original,
                technology: this.extractTechnology(text)
            },
            requiresAdmin: SecurityManager.isAdminOnlyTopic(text),
            contextual: this.isContextual(text, context)
        };
    }

    recognizeCommand(command) {
        const normalized = SecurityManager.normalizeForSearch(command.split(/\s+/)[0]);
        const map = {
            '/dev': { name: 'developer_dashboard', requiresAdmin: true },
            '/status': { name: 'system_status' },
            '/help': { name: 'help' },
            '/about': { name: 'about' },
            '/matrix': { name: 'matrix' }
        };

        return {
            ...(map[normalized] || { name: 'help' }),
            confidence: 1,
            entities: { command: normalized }
        };
    }

    recognizeAdminAction(text) {
        if (this.matchesAny(text, ['novo projeto', 'criar projeto', 'cadastre um projeto', 'adicionar projeto'])) {
            return {
                name: 'admin_action',
                confidence: 0.95,
                requiresAdmin: true,
                entities: { action: 'new_project' }
            };
        }

        if (this.matchesAny(text, ['novo post', 'criar post', 'crie um novo post', 'publicar post'])) {
            return {
                name: 'admin_action',
                confidence: 0.95,
                requiresAdmin: true,
                entities: { action: 'new_post' }
            };
        }

        if (this.matchesAny(text, ['editar imagem', 'editar a imagem', 'galeria para editar'])) {
            return {
                name: 'admin_action',
                confidence: 0.95,
                requiresAdmin: true,
                entities: {
                    action: 'edit_gallery_image',
                    imageId: this.extractNumber(text)
                }
            };
        }

        if (this.matchesAny(text, ['abrir logs', 'ver logs', 'logs de seguranca'])) {
            return {
                name: 'admin_action',
                confidence: 0.9,
                requiresAdmin: true,
                entities: { action: 'open_logs' }
            };
        }

        if (this.matchesAny(text, ['abrir github', 'status github', 'repositorio'])) {
            return {
                name: 'admin_action',
                confidence: 0.85,
                requiresAdmin: true,
                entities: { action: 'open_github' }
            };
        }

        if (this.matchesAny(text, ['configuracoes', 'abrir configuracoes', 'preferencias'])) {
            return {
                name: 'admin_action',
                confidence: 0.85,
                requiresAdmin: true,
                entities: { action: 'open_settings' }
            };
        }

        if (this.matchesAny(text, ['developer dashboard', 'painel desenvolvedor', 'modo dev'])) {
            return {
                name: 'developer_dashboard',
                confidence: 0.95,
                requiresAdmin: true,
                entities: {}
            };
        }

        return null;
    }

    recognizeOpenIntent(text) {
        const targets = [
            { terms: ['home', 'inicio', 'pagina inicial'], target: 'home' },
            { terms: ['projetos', 'projects'], target: 'projetos' },
            { terms: ['contato', 'contact'], target: 'contato' },
            { terms: ['galeria'], target: 'galeria' },
            { terms: ['admin', 'painel'], target: 'dashboard', requiresAdmin: true }
        ];

        const match = targets.find((entry) => entry.terms.some((term) => text.includes(term)));

        return {
            name: 'open_page',
            confidence: match ? 0.9 : 0.5,
            requiresAdmin: Boolean(match && match.requiresAdmin),
            entities: {
                target: match ? match.target : 'home'
            }
        };
    }

    isContextual(text, context = {}) {
        const contextualTerms = [
            'deles',
            'delas',
            'desse',
            'dessa',
            'destes',
            'dessas',
            'qual deles',
            'qual delas',
            'essa lista',
            'esses projetos'
        ];

        return Boolean(
            contextualTerms.some((term) => text.includes(term)) &&
            context.memory &&
            context.memory.lastResults &&
            context.memory.lastResults.length
        );
    }

    extractTechnology(text) {
        const technologies = [
            'javascript',
            'node',
            'node.js',
            'websockets',
            'python',
            'fastapi',
            'docker',
            'selenium',
            'html',
            'css'
        ];

        return technologies.find((technology) => text.includes(technology)) || null;
    }

    extractStatus(text) {
        if (text.includes('ativo')) return 'ativo';
        if (text.includes('teste')) return 'em teste';
        if (text.includes('arquivado')) return 'arquivado';
        return null;
    }

    extractNumber(text) {
        const match = text.match(/\d+/);
        return match ? Number(match[0]) : null;
    }

    matchesAny(text, terms) {
        return terms.some((term) => text.includes(term));
    }

    getSuggestions({ isAdmin = false } = {}) {
        const publicSuggestions = [
            { label: 'Pesquisar Linux', value: 'Pesquisar Linux' },
            { label: 'Mostrar projetos', value: 'Mostrar projetos' },
            { label: 'Abrir galeria', value: 'Abrir galeria' },
            { label: 'Últimos posts', value: 'Últimos posts' },
            { label: 'Novidades', value: 'Novidades' },
            { label: 'Categorias', value: 'Categorias' }
        ];

        const adminSuggestions = [
            { label: '/status', value: '/status', requiresAdmin: true },
            { label: '/dev', value: '/dev', requiresAdmin: true },
            { label: 'Novo projeto', value: 'Criar novo projeto', requiresAdmin: true },
            { label: 'Ver logs', value: 'Abrir logs', requiresAdmin: true },
            { label: 'Status GitHub', value: 'Status GitHub', requiresAdmin: true }
        ];

        return isAdmin ? [...publicSuggestions, ...adminSuggestions] : publicSuggestions;
    }
}
