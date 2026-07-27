import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDVPMhCRseqz0cVS8d9BaG7Uy9-RVLCEJo",
    authDomain: "blog-secreto.firebaseapp.com",
    projectId: "blog-secreto",
    storageBucket: "blog-secreto.firebasestorage.app",
    messagingSenderId: "615148818707",
    appId: "1:615148818707:web:bb3b3f53a9c0164cba8ae6",
    measurementId: "G-LHH8H4V5DD"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);