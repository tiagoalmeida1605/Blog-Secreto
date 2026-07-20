export class PermissionManager {
    constructor() {
        this.isAdmin = this._checkAdminContext();
        this.isAdminPath = this._isAdminPath();
        this.context = this.isAdmin ? 'admin' : 'public';
    }

    _checkAdminContext() {
        const isUrlAdmin = this._isAdminPath();
        const hasSession = sessionStorage.getItem('secreto_session_active') === 'true';
        return isUrlAdmin && hasSession;
    }

    _isAdminPath() {
        return /(^|\/)admin(\/|$)/.test(window.location.pathname);
    }

    refresh() {
        this.isAdmin = this._checkAdminContext();
        this.isAdminPath = this._isAdminPath();
        this.context = this.isAdmin ? 'admin' : 'public';
        return this.context;
    }

    getModeLabel() {
        return this.isAdmin ? 'Modo Administrador' : 'Modo Público';
    }

    getSystemPrompt() {
        if (this.isAdmin) {
            return [
                'Você é o assistente administrativo do Blog Secreto.',
                'Permissões: leitura de dados públicos e administrativos locais, abertura de módulos do painel e ações de navegação.',
                'Diretriz: seja técnico, direto e não execute alterações destrutivas sem confirmação explícita.'
            ].join(' ');
        }

        return [
            'Você é o assistente público do Blog Secreto.',
            'Permissões: apenas conteúdos públicos como posts, projetos, páginas, categorias, tags e galeria pública.',
            'Diretriz: responda em português brasileiro, seja objetivo e nunca revele dados internos.'
        ].join(' ');
    }

    canAccess(resource) {
        const publicResources = new Set([
            'posts',
            'projects',
            'gallery',
            'categories',
            'tags',
            'pages',
            'public_changelog',
            'search'
        ]);

        if (publicResources.has(resource)) return true;
        return this.isAdmin;
    }

    requireAdmin() {
        if (!this.isAdmin) {
            throw new Error('Ação restrita ao modo administrador.');
        }
    }

    getPublicRouteMap() {
        return {
            home: '/index.html',
            inicio: '/index.html',
            projetos: '/pages/projetos.html',
            projects: '/pages/projetos.html',
            contato: '/pages/contato.html',
            contact: '/pages/contato.html'
        };
    }

    getAdminRouteMap() {
        return {
            dashboard: '/admin/index.html',
            painel: '/admin/index.html',
            projetos: '/admin/projetos.html',
            novoProjeto: '/admin/projetos.html?assistantAction=newProject',
            configuracoes: '/admin/configuracoes.html',
            logs: '#developer-dashboard',
            github: '#developer-dashboard'
        };
    }

    filterSuggestions(suggestions) {
        return suggestions.filter((suggestion) => !suggestion.requiresAdmin || this.isAdmin);
    }
}
