import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5G8H6cwln1vVelt2qiz1Ja_bwzvoEUDs",
  authDomain: "blog-secretov2.firebaseapp.com",
  projectId: "blog-secretov2",
  storageBucket: "blog-secretov2.firebasestorage.app",
  messagingSenderId: "567801430872",
  appId: "1:567801430872:web:49c9bb0b98d51e15f6db2d",
  measurementId: "G-SSVPPY89SL"
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
