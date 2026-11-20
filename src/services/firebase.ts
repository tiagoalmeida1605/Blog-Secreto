import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB5G8H6cwln1vVelt2qiz1Ja_bwzvoEUDs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "blog-secretov2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "blog-secretov2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "blog-secretov2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "567801430872",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:567801430872:web:49c9bb0b98d51e15f6db2d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-SSVPPY89SL",
};

const app = getApps().some(({ name }) => name === "[DEFAULT]")
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const authPersistence = setPersistence(auth, browserLocalPersistence);
