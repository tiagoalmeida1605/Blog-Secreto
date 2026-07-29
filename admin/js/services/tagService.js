import { db } from "../../../firebase/firebase.js";
import {
    collection,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tagsRef = collection(db, "tags");

export const TagService = {
    /**
     * Gera um slug limpo e amigável a partir de uma string.
     * Exemplos:
     * - "JavaScript" -> "javascript"
     * - "C#" -> "c-sharp"
     * - "C++" -> "c-plus-plus"
     * - "Node.js" -> "node-js"
     * - ".NET" -> "dotnet"
     */
    generateSlug(text) {
        if (!text) return "";
        let slug = String(text).trim();

        // Substituições conhecidas de símbolos de tecnologia
        slug = slug
            .replace(/c#/gi, "c-sharp")
            .replace(/c\+\+/gi, "c-plus-plus")
            .replace(/\.net/gi, "dotnet");

        // Normalização de acentos (NFD)
        slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Substitui pontos e espaços por hífens, converte pra minúsculas
        slug = slug
            .toLowerCase()
            .replace(/\./g, "-")
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        return slug;
    },

    /**
     * Retorna todas as tags cadastradas ordenadas pelo campo 'ordem' (e nome como fallback).
     */
    async getTags() {
        try {
            const q = query(tagsRef);
            const snapshot = await getDocs(q);
            const tags = snapshot.docs.map(documento => ({
                slug: documento.id,
                ...documento.data()
            }));

            // Ordena localmente por ordem crescente e depois por nome
            return tags.sort((a, b) => {
                const ordemA = Number.isFinite(a.ordem) ? a.ordem : 999;
                const ordemB = Number.isFinite(b.ordem) ? b.ordem : 999;
                if (ordemA !== ordemB) return ordemA - ordemB;
                return (a.nome || '').localeCompare(b.nome || '');
            });
        } catch (erro) {
            console.error("Erro ao buscar tags no Firestore:", erro);
            throw new Error("Não foi possível carregar as tags do Firestore.");
        }
    },

    /**
     * Retorna uma única tag pelo slug (Document ID).
     */
    async getTag(slug) {
        if (!slug) return null;
        try {
            const docRef = doc(db, "tags", slug);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) return null;
            return {
                slug: snapshot.id,
                ...snapshot.data()
            };
        } catch (erro) {
            console.error(`Erro ao buscar tag '${slug}':`, erro);
            throw new Error(`Não foi possível buscar a tag '${slug}'.`);
        }
    },

    /**
     * Cria uma nova tag com o slug como Document ID.
     * Estrutura exata do documento:
     * {
     *     "nome": "Python",
     *     "slug": "python",
     *     "categoria": "Linguagem",
     *     "cor": "#3776AB",
     *     "icone": "🐍",
     *     "ordem": 1,
     *     "ativo": true,
     *     "descricao": "Linguagem de programação"
     * }
     */
    async createTag(tagData) {
        const slug = this.generateSlug(tagData.slug || tagData.nome);

        if (!slug) {
            throw new Error("Slug inválido para a tag.");
        }

        // Verifica se já existe documento com esse slug
        const tagExistente = await this.getTag(slug);
        if (tagExistente) {
            throw new Error(`Já existe uma tag cadastrada com o slug '${slug}'.`);
        }

        const novoDocumento = {
            nome: String(tagData.nome || '').trim(),
            slug: slug,
            categoria: String(tagData.categoria || 'Outros').trim(),
            cor: tagData.cor || '#3776AB',
            icone: tagData.icone || '🏷️',
            ordem: parseInt(tagData.ordem, 10) || 1,
            ativo: tagData.ativo !== false,
            descricao: String(tagData.descricao || '').trim()
        };

        const docRef = doc(db, "tags", slug);
        await setDoc(docRef, novoDocumento);
        return { slug, ...novoDocumento };
    },

    /**
     * Atualiza os dados de uma tag existente.
     * Se o slug tiver mudado, move o documento para a nova ID.
     */
    async updateTag(currentSlug, tagData) {
        const newSlug = this.generateSlug(tagData.slug || tagData.nome);

        if (!newSlug) {
            throw new Error("Slug inválido para a tag.");
        }

        const dadosFormatados = {
            nome: String(tagData.nome || '').trim(),
            slug: newSlug,
            categoria: String(tagData.categoria || 'Outros').trim(),
            cor: tagData.cor || '#3776AB',
            icone: tagData.icone || '🏷️',
            ordem: parseInt(tagData.ordem, 10) || 1,
            ativo: tagData.ativo !== false,
            descricao: String(tagData.descricao || '').trim()
        };

        // Se o slug mudou
        if (newSlug !== currentSlug) {
            const jaExiste = await this.getTag(newSlug);
            if (jaExiste) {
                throw new Error(`Já existe outra tag cadastrada com o slug '${newSlug}'.`);
            }
            // Cria no novo slug e deleta o antigo
            await setDoc(doc(db, "tags", newSlug), dadosFormatados);
            await deleteDoc(doc(db, "tags", currentSlug));
        } else {
            // Atualiza no slug atual
            const docRef = doc(db, "tags", currentSlug);
            await updateDoc(docRef, dadosFormatados);
        }

        return { slug: newSlug, ...dadosFormatados };
    },

    /**
     * Exclui uma tag pelo slug.
     */
    async deleteTag(slug) {
        if (!slug) return false;
        try {
            const docRef = doc(db, "tags", slug);
            await deleteDoc(docRef);
            return true;
        } catch (erro) {
            console.error(`Erro ao excluir tag '${slug}':`, erro);
            throw new Error(`Não foi possível excluir a tag '${slug}'.`);
        }
    },

    /**
     * Pesquisa e filtra tags localmente por texto e categoria.
     */
    searchTags(tags, queryText, categoria = "todas") {
        const busca = (queryText || "").toLowerCase().trim();
        const cat = (categoria || "todas").toLowerCase().trim();

        return tags.filter(tag => {
            const bateCategoria = cat === "todas" || (tag.categoria || "").toLowerCase() === cat;
            if (!bateCategoria) return false;

            if (!busca) return true;

            const conteudo = `${tag.nome || ''} ${tag.slug || ''} ${tag.descricao || ''} ${tag.categoria || ''}`.toLowerCase();
            return conteudo.includes(busca);
        });
    }
};

window.TagService = TagService;
