import { StorageManager } from './StorageManager.js';
import { SecurityManager } from '../core/SecurityManager.js';

export const API_ENDPOINTS = Object.freeze({
    search: '/api/search',
    posts: '/api/posts',
    projects: '/api/projects',
    gallery: '/api/gallery',
    categories: '/api/categories',
    tags: '/api/tags',
    pages: '/api/pages',
    changelog: '/api/changelog',
    chat: '/api/chat'
});

export class ApiService {
    constructor({ storage = new StorageManager(), baseUrl = '', useRemote = false } = {}) {
        this.storage = storage;
        this.baseUrl = baseUrl;
        this.useRemote = useRemote;
        this.startedAt = Date.now();
        this.endpoints = API_ENDPOINTS;
    }

    async getSearchIndex({ isAdmin = false } = {}) {
        const [posts, projects, gallery, categories, tags, pages, changelog] = await Promise.all([
            this.getPosts(),
            this.getProjects(),
            this.getGallery(),
            this.getCategories(),
            this.getTags(),
            this.getPages(),
            this.getChangelog()
        ]);

        return {
            posts,
            projects,
            gallery,
            categories,
            tags,
            pages,
            changelog,
            admin: isAdmin ? this.getAdminKnowledge() : []
        };
    }

    async getPosts() {
        return this.remoteOrLocal('posts', () => this.storage.getPosts());
    }

    async getProjects() {
        return this.remoteOrLocal('projects', () => this.storage.getProjects());
    }

    async getGallery() {
        return this.remoteOrLocal('gallery', async () => {
            const projects = this.storage.getProjects();
            return projects
                .filter((project) => project.imagem)
                .map((project) => ({
                    id: `project-image-${project.id}`,
                    title: `Imagem do projeto ${project.nome}`,
                    description: project.descricao,
                    href: '/pages/projetos.html',
                    image: SecurityManager.safeUrl(project.imagem),
                    tags: ['galeria', ...(project.tecnologias || [])]
                }));
        });
    }

    async getCategories() {
        return this.remoteOrLocal('categories', async () => {
            const projects = this.storage.getProjects();
            const posts = this.storage.getPosts();
            const categoryNames = new Set(['Projetos', 'Páginas', 'Contato']);

            projects.forEach((project) => {
                if (project.status) categoryNames.add(project.status);
            });

            posts.forEach((post) => {
                if (post.category) categoryNames.add(post.category);
                if (post.categoria) categoryNames.add(post.categoria);
            });

            return [...categoryNames].map((name) => ({
                id: SecurityManager.normalizeForSearch(name).replace(/\s+/g, '-'),
                title: name,
                description: `Conteúdos relacionados a ${name}.`,
                href: name === 'Projetos' ? '/pages/projetos.html' : '/index.html',
                tags: ['categoria']
            }));
        });
    }

    async getTags() {
        return this.remoteOrLocal('tags', async () => {
            const tags = new Set();

            this.storage.getProjects().forEach((project) => {
                (project.tecnologias || []).forEach((tag) => tags.add(tag));
                if (project.status) tags.add(project.status);
            });

            this.storage.getPosts().forEach((post) => {
                (post.tags || []).forEach((tag) => tags.add(tag));
            });

            return [...tags].map((name) => ({
                id: SecurityManager.normalizeForSearch(name).replace(/\s+/g, '-'),
                title: name,
                description: `Tag usada nos conteúdos do Blog Secreto.`,
                href: '/pages/projetos.html',
                tags: ['tag']
            }));
        });
    }

    async getPages() {
        return this.remoteOrLocal('pages', () => [
            {
                id: 'home',
                title: 'Home',
                description: 'Página inicial do Blog Secreto, com apresentação do projeto.',
                href: '/index.html',
                tags: ['início', 'blog']
            },
            {
                id: 'projects',
                title: 'Projetos',
                description: 'Lista pública de projetos e experimentos do Blog Secreto.',
                href: '/pages/projetos.html',
                tags: ['projetos', 'tecnologia']
            },
            {
                id: 'contact',
                title: 'Contato',
                description: 'Página com formulário e canais públicos de contato.',
                href: '/pages/contato.html',
                tags: ['contato']
            }
        ]);
    }

    async getChangelog() {
        return this.remoteOrLocal('changelog', () => this.storage.getChangelog());
    }

    async chat(message, context) {
        return this.remoteOrLocal('chat', () => ({
            message,
            context,
            provider: 'local'
        }), {
            method: 'POST',
            body: JSON.stringify({ message, context })
        });
    }

    async getAdminSnapshot() {
        const projects = await this.getProjects();
        const posts = await this.getPosts();
        const gallery = await this.getGallery();
        const tags = await this.getTags();
        const logs = this.storage.getLogs();
        const storageBytes = this.storage.getLocalStorageSize();
        const memory = this.getMemoryInfo();
        const uptimeMs = Date.now() - this.startedAt;

        return {
            version: 'v0.1-alpha',
            counts: {
                posts: posts.length,
                projects: projects.length,
                images: gallery.length,
                comments: 0,
                likes: 0,
                tags: tags.length,
                logs: logs.length,
                onlineUsers: 1
            },
            system: {
                storage: this.formatBytes(storageBytes),
                memory: memory.label,
                cpu: 'N/D no navegador',
                uptime: this.formatDuration(uptimeMs),
                server: 'Local/static ativo',
                database: 'LocalStorage',
                cache: 'Navegador',
                api: this.useRemote ? 'Remota configurada' : 'Fallback local',
                auth: sessionStorage.getItem('secreto_session_active') === 'true' ? 'Sessão admin ativa' : 'Sessão pública'
            },
            github: {
                status: 'Integração preparada',
                lastCommit: 'N/D',
                branch: 'N/D',
                stars: 'N/D',
                forks: 'N/D',
                languages: 'N/D',
                repositories: 'N/D',
                updatedAt: 'N/D'
            },
            endpoints: this.endpoints,
            logs
        };
    }

    getAdminKnowledge() {
        return [
            {
                id: 'admin-dashboard',
                title: 'Painel administrativo',
                description: 'Visão geral com estatísticas, status do servidor local e ações rápidas.',
                href: '/admin/index.html',
                tags: ['admin', 'dashboard', 'estatísticas']
            },
            {
                id: 'admin-projects',
                title: 'Gerenciamento de projetos',
                description: 'CRUD local para criar, editar, filtrar e remover projetos salvos no LocalStorage.',
                href: '/admin/projetos.html',
                tags: ['admin', 'projetos', 'crud']
            },
            {
                id: 'admin-settings',
                title: 'Configurações do sistema',
                description: 'Preferências do painel administrativo e base para futuras configurações.',
                href: '/admin/configuracoes.html',
                tags: ['admin', 'configurações']
            },
            {
                id: 'admin-security',
                title: 'Segurança',
                description: 'Login simulado por sessão, sanitização de entrada, rate limit local e bloqueio de recursos internos no modo público.',
                href: '#developer-dashboard',
                tags: ['segurança', 'sessão', 'rate limit']
            },
            {
                id: 'admin-apis',
                title: 'APIs preparadas',
                description: Object.values(this.endpoints).join(', '),
                href: '#developer-dashboard',
                tags: ['api', 'integração', 'backend']
            }
        ];
    }

    async remoteOrLocal(endpointKey, localFactory, options = {}) {
        if (this.shouldUseRemote() && this.endpoints[endpointKey]) {
            try {
                return await this.request(this.endpoints[endpointKey], options);
            } catch (error) {
                console.warn(`[Assistente IA] API ${endpointKey} indisponível. Usando fallback local.`, error);
            }
        }

        return typeof localFactory === 'function' ? localFactory() : localFactory;
    }

    shouldUseRemote() {
        return Boolean(this.useRemote && /^https?:$/.test(window.location.protocol));
    }

    async request(path, options = {}) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`Falha na API: ${response.status}`);
        }

        return response.json();
    }

    getMemoryInfo() {
        if (performance && performance.memory) {
            return {
                label: `${this.formatBytes(performance.memory.usedJSHeapSize)} / ${this.formatBytes(performance.memory.jsHeapSizeLimit)}`
            };
        }

        return { label: 'N/D no navegador' };
    }

    formatBytes(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
    }

    formatDuration(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes < 1) return `${seconds}s`;
        return `${minutes}min ${seconds}s`;
    }
}
