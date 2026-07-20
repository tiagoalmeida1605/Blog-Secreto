export const AI_ASSISTANT_ROUTES = [
    {
        method: 'GET',
        path: '/api/search',
        auth: 'public',
        query: ['q', 'type', 'limit'],
        description: 'Pesquisa unificada em posts, projetos, páginas, tags, categorias, galeria e changelog público.'
    },
    {
        method: 'GET',
        path: '/api/posts',
        auth: 'public',
        query: ['q', 'category', 'tag', 'limit'],
        description: 'Lista posts publicados.'
    },
    {
        method: 'GET',
        path: '/api/projects',
        auth: 'public',
        query: ['q', 'technology', 'status', 'limit'],
        description: 'Lista projetos publicados.'
    },
    {
        method: 'GET',
        path: '/api/gallery',
        auth: 'public',
        query: ['q', 'tag', 'limit'],
        description: 'Lista imagens públicas e metadados de galeria.'
    },
    {
        method: 'GET',
        path: '/api/categories',
        auth: 'public',
        query: ['q'],
        description: 'Lista categorias públicas.'
    },
    {
        method: 'GET',
        path: '/api/tags',
        auth: 'public',
        query: ['q'],
        description: 'Lista tags públicas.'
    },
    {
        method: 'GET',
        path: '/api/pages',
        auth: 'public',
        query: ['q'],
        description: 'Lista páginas públicas indexáveis.'
    },
    {
        method: 'GET',
        path: '/api/changelog',
        auth: 'public-admin-scoped',
        query: ['q', 'admin'],
        description: 'Lista changelog público e, com autenticação, entradas administrativas.'
    },
    {
        method: 'POST',
        path: '/api/chat',
        auth: 'public-admin-scoped',
        body: ['message', 'context', 'provider'],
        description: 'Executa o provedor configurado e devolve texto, resultados, ações e metadados.'
    }
];

export const AI_ASSISTANT_RESPONSE_SHAPE = {
    text: 'string',
    results: 'Array<{ id, type, title, description, href, tags }>',
    actions: 'Array<{ label, type, href, payload }>',
    meta: 'Object'
};

export function routeRequiresAdmin(route) {
    return route.auth === 'admin';
}

export function canExposeRoute(route, isAdmin) {
    if (route.auth === 'public') return true;
    if (route.auth === 'public-admin-scoped') return true;
    return Boolean(isAdmin);
}
