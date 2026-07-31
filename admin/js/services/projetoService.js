import { db } from "../../../firebase/firebase.js";
import {
    collection,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    addDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const projetosRef = collection(db, "projetos");
const VIEW_STORAGE_PREFIX = "view_";
const VIEW_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 horas

export const ProjetoService = {
    /**
     * Retorna todos os projetos cadastrados no Firestore.
     * Normaliza dados e garante compatibilidade com o novo campo 'tags'.
     */
    async getProjetos() {
        try {
            const snapshot = await getDocs(projetosRef);
            return snapshot.docs.map(documento => ({
                id: documento.id,
                ...documento.data()
            }));
        } catch (erro) {
            console.error("Erro ao buscar projetos no Firestore:", erro);
            throw new Error("Não foi possível carregar os projetos do Firestore.");
        }
    },

    /**
     * Retorna um projeto específico pelo ID.
     */
    async getProjeto(id) {
        if (!id) return null;
        try {
            const docRef = doc(db, "projetos", id);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) return null;
            return {
                id: snapshot.id,
                ...snapshot.data()
            };
        } catch (erro) {
            console.error(`Erro ao buscar projeto '${id}':`, erro);
            throw new Error(`Não foi possível buscar o projeto '${id}'.`);
        }
    },

    /**
     * Cria um novo projeto.
     * Aceita campo 'tags' como array de slugs.
     */
    async createProjeto(projetoData) {
        const novoDocumento = {
            titulo: String(projetoData.titulo || projetoData.nome || '').trim(),
            descricao: String(projetoData.descricao || '').trim(),
            status: String(projetoData.status || 'Ativo').trim(),
            versao: String(projetoData.versao || '').trim(),
            tags: Array.isArray(projetoData.tags) ? projetoData.tags : [],
            imagem: String(projetoData.imagem || projetoData.imageUrl || '').trim(),
            site: String(projetoData.site || projetoData.link || '').trim(),
            imageUrl: projetoData.imageUrl || null,
            imagePath: projetoData.imagePath || null,
            imageType: projetoData.imageType || null,
            imageSize: projetoData.imageSize || null,
            imageUploadedAt: projetoData.imageUploadedAt || null
        };

        try {
            const docRef = await addDoc(projetosRef, novoDocumento);
            return {
                id: docRef.id,
                ...novoDocumento
            };
        } catch (erro) {
            console.error("Erro ao criar projeto no Firestore:", erro);
            throw new Error("Não foi possível criar o projeto no Firestore.");
        }
    },

    /**
     * Atualiza um projeto existente.
     * Mantém compatibilidade com campo 'tags'.
     */
    async updateProjeto(id, projetoData) {
        if (!id) throw new Error("ID do projeto inválido.");

        const dadosFormatados = {
            titulo: String(projetoData.titulo || projetoData.nome || '').trim(),
            descricao: String(projetoData.descricao || '').trim(),
            status: String(projetoData.status || 'Ativo').trim(),
            versao: String(projetoData.versao || '').trim(),
            tags: Array.isArray(projetoData.tags) ? projetoData.tags : [],
            imagem: String(projetoData.imagem || projetoData.imageUrl || '').trim(),
            site: String(projetoData.site || projetoData.link || '').trim(),
            imageUrl: projetoData.imageUrl || null,
            imagePath: projetoData.imagePath || null,
            imageType: projetoData.imageType || null,
            imageSize: projetoData.imageSize || null,
            imageUploadedAt: projetoData.imageUploadedAt || null
        };

        try {
            const docRef = doc(db, "projetos", id);
            await updateDoc(docRef, dadosFormatados);
            return {
                id,
                ...dadosFormatados
            };
        } catch (erro) {
            console.error(`Erro ao atualizar projeto '${id}':`, erro);
            throw new Error(`Não foi possível atualizar o projeto '${id}'.`);
        }
    },

    /**
     * Exclui um projeto pelo ID.
     */
    async deleteProjeto(id) {
        if (!id) return false;
        try {
            const docRef = doc(db, "projetos", id);
            await deleteDoc(docRef);
            return true;
        } catch (erro) {
            console.error(`Erro ao excluir projeto '${id}':`, erro);
            throw new Error(`Não foi possível excluir o projeto '${id}'.`);
        }
    },

    /**
     * Incrementa o contador de visualizações de forma atômica.
     * Usa FieldValue.increment do Firestore para evitar race conditions.
     */
    async incrementarViews(id) {
        if (!id) return false;
        try {
            const docRef = doc(db, "projetos", id);
            await updateDoc(docRef, { views: increment(1) });
            return true;
        } catch (erro) {
            console.error(`Erro ao incrementar visualizações do projeto '${id}':`, erro);
            return false;
        }
    },

    /**
     * Registra uma visualização com proteção contra F5 (localStorage 24h).
     * Retorna true se incrementou, false se já visualizou recentemente.
     */
    async registrarVisualizacao(id) {
        if (!id) return false;
        const storageKey = `${VIEW_STORAGE_PREFIX}${id}`;
        const agora = Date.now();
        const ultimaVisualizacao = localStorage.getItem(storageKey);

        if (ultimaVisualizacao && (agora - parseInt(ultimaVisualizacao, 10)) < VIEW_EXPIRATION_MS) {
            return false; // Já visualizou nas últimas 24h
        }

        const incrementou = await this.incrementarViews(id);
        if (incrementou) {
            localStorage.setItem(storageKey, agora.toString());
        }
        return incrementou;
    },

    /**
     * Obtém apenas o contador de visualizações de um projeto.
     */
    async getViews(id) {
        if (!id) return 0;
        try {
            const docRef = doc(db, "projetos", id);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) return 0;
            const data = snapshot.data();
            return typeof data.views === 'number' ? data.views : 0;
        } catch (erro) {
            console.error(`Erro ao buscar visualizações do projeto '${id}':`, erro);
            return 0;
        }
    },

    /**
     * Formata número de visualizações para exibição amigável.
     * Exemplos: 980 → "980", 1200 → "1,2 mil", 15400 → "15,4 mil", 1300000 → "1,3 milhão"
     */
    formatarViews(views) {
        const n = Number(views) || 0;
        if (n < 1000) return n.toString();
        if (n < 1000000) {
            return (n / 1000).toFixed(1).replace('.', ',') + ' mil';
        }
        if (n < 1000000000) {
            return (n / 1000000).toFixed(1).replace('.', ',') + ' milhão';
        }
        return (n / 1000000000).toFixed(1).replace('.', ',') + ' bilhão';
    }
};

window.ProjetoService = ProjetoService;
