import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Crie um projeto Firebase SEPARADO para a v2 e cole aqui a configuração dele.
// Não reutilize o projeto da versão antiga se quiser manter o sistema anterior intacto.
const firebaseConfig = {
  apiKey: "COLE_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "COLE_SENDER_ID_AQUI",
  appId: "COLE_APP_ID_AQUI"
};

export const isFirebaseConfigured = !Object.values(firebaseConfig).some(
  (value) => value.startsWith("COLE_") || value.startsWith("SEU_")
);

let auth = null;
let db = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db };
