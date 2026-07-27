import { db } from "../../firebase/firebase.js";

import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const projetosRef = collection(db, "projetos");


const FirebaseStore = {

    async getProjetos() {
        const snapshot = await getDocs(projetosRef);

        return snapshot.docs.map(documento => ({
            id: documento.id,
            ...documento.data()
        }));
    },


    async addProjeto(projeto) {
        const docRef = await addDoc(projetosRef, projeto);

        return {
            id: docRef.id,
            ...projeto
        };
    },


    async updateProjeto(id, dados) {
        const projetoRef = doc(db, "projetos", id);

        await updateDoc(projetoRef, dados);

        return {
            id,
            ...dados
        };
    },


    async deleteProjeto(id) {
        const projetoRef = doc(db, "projetos", id);

        await deleteDoc(projetoRef);

        return true;
    }

};


window.FirebaseStore = FirebaseStore;