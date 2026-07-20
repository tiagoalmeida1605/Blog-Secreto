import { SecurityManager } from './SecurityManager.js';

const TYPE_LABELS = {
    post: 'Post',
    project: 'Projeto',
    page: 'Página',
    category: 'Categoria',
    tag: 'Tag',
    gallery: 'Galeria',
    changelog: 'Changelog',
    admin: 'Admin'
};

export class SearchEngine {
    search(query, data, options = {}) {
        const normalizedQuery = SecurityManager.normalizeForSearch(query);
        const tokens = this.tokenize(normalizedQuery);
        const includeAdmin = Boolean(options.includeAdmin);
        const contextItems = Array.isArray(options.contextItems) ? options.contextItems : [];
        const allItems = contextItems.length ? contextItems : this.flattenData(data, includeAdmin);

        if (!normalizedQuery && !options.returnAll) {
            return this.emptyResult(query);
        }

        const scored = allItems
            .map((item) => ({
                ...item,
                score: this.scoreItem(item, normalizedQuery, tokens)
            }))
            .filter((item) => item.score > 0 || options.returnAll)
            .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'pt-BR'))
            .slice(0, options.limit || 10);

        return {
            query,
            total: scored.length,
            results: scored,
            groups: this.groupByType(scored)
        };
    }

    flattenData(data = {}, includeAdmin = false) {
        const items = [];

        (data.posts || []).forEach((post) => {
            items.push(this.normalizeItem({
                id: post.id,
                type: 'post',
                title: post.title || post.titulo,
                description: post.description || post.resumo || post.content || post.conteudo,
                content: post.content || post.conteudo,
                tags: post.tags || [],
                href: post.href || post.path || '#'
            }));
        });

        (data.projects || []).forEach((project) => {
            items.push(this.normalizeItem({
                id: project.id,
                type: 'project',
                title: project.nome || project.title,
                description: project.descricao || project.description,
                content: [
                    project.status,
                    project.versao,
                    ...(project.tecnologias || [])
                ].join(' '),
                tags: project.tecnologias || [],
                href: project.link && project.link !== '#' ? project.link : '/pages/projetos.html',
                source: project
            }));
        });

        (data.pages || []).forEach((page) => items.push(this.normalizeItem({ ...page, type: 'page' })));
        (data.categories || []).forEach((category) => items.push(this.normalizeItem({ ...category, type: 'category' })));
        (data.tags || []).forEach((tag) => items.push(this.normalizeItem({ ...tag, type: 'tag' })));
        (data.gallery || []).forEach((image) => items.push(this.normalizeItem({ ...image, type: 'gallery' })));
        (data.changelog || []).forEach((entry) => items.push(this.normalizeItem({ ...entry, type: 'changelog' })));

        if (includeAdmin) {
            (data.admin || []).forEach((entry) => items.push(this.normalizeItem({ ...entry, type: 'admin' })));
        }

        return items.filter((item) => item.title);
    }

    normalizeItem(item) {
        const tags = Array.isArray(item.tags) ? item.tags : [];

        return {
            id: String(item.id || SecurityManager.createId('item')),
            type: item.type || 'content',
            typeLabel: TYPE_LABELS[item.type] || item.type || 'Conteúdo',
            title: SecurityManager.sanitize(item.title || item.name || item.nome || ''),
            description: SecurityManager.sanitize(item.description || item.descricao || ''),
            content: SecurityManager.sanitize(item.content || ''),
            href: SecurityManager.safeUrl(item.href || item.path || '#'),
            tags: tags.map((tag) => SecurityManager.sanitize(tag)),
            source: item.source || item
        };
    }

    scoreItem(item, normalizedQuery, tokens) {
        if (!normalizedQuery) return 1;

        const title = SecurityManager.normalizeForSearch(item.title);
        const description = SecurityManager.normalizeForSearch(item.description);
        const content = SecurityManager.normalizeForSearch(item.content);
        const tags = SecurityManager.normalizeForSearch((item.tags || []).join(' '));
        const type = SecurityManager.normalizeForSearch(`${item.type} ${item.typeLabel}`);
        let score = 0;

        if (title.includes(normalizedQuery)) score += 40;
        if (tags.includes(normalizedQuery)) score += 26;
        if (description.includes(normalizedQuery)) score += 18;
        if (content.includes(normalizedQuery)) score += 10;
        if (type.includes(normalizedQuery)) score += 12;

        tokens.forEach((token) => {
            if (title.includes(token)) score += 10;
            if (tags.includes(token)) score += 8;
            if (description.includes(token)) score += 4;
            if (content.includes(token)) score += 2;
            if (type.includes(token)) score += 3;
        });

        if (normalizedQuery.includes('projeto') && item.type === 'project') score += 18;
        if (normalizedQuery.includes('post') && item.type === 'post') score += 18;
        if (normalizedQuery.includes('galeria') && item.type === 'gallery') score += 18;
        if (normalizedQuery.includes('categoria') && item.type === 'category') score += 18;
        if (normalizedQuery.includes('tag') && item.type === 'tag') score += 18;

        return score;
    }

    tokenize(text) {
        return SecurityManager.normalizeForSearch(text)
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length > 2);
    }

    groupByType(results) {
        return results.reduce((groups, item) => {
            const key = item.typeLabel || item.type;
            groups[key] = groups[key] || [];
            groups[key].push(item);
            return groups;
        }, {});
    }

    emptyResult(query) {
        return {
            query,
            total: 0,
            results: [],
            groups: {}
        };
    }
}
