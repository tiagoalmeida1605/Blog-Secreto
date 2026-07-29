import { db } from "../../../firebase/firebase.js";
import {
    collection,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const projetosRef = collection(db, "projetos");

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
            imagem: String(projetoData.imagem || '').trim(),
            site: String(projetoData.site || projetoData.link || '').trim()
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
            imagem: String(projetoData.imagem || '').trim(),
            site: String(projetoData.site || projetoData.link || '').trim()
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
    }
};

window.ProjetoService = ProjetoService;
