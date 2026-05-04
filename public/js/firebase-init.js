// ═══════════════════════════════════════════════════════════════
// firebase-init.js — Inicialização do Firebase (App + Auth + DB)
// ═══════════════════════════════════════════════════════════════
// Cria DUAS instâncias:
//   - app/auth/db: instância principal (sessão do usuário logado)
//   - appB/authB:  instância secundária usada para criar novos
//                  usuários (createUserWithEmailAndPassword) sem
//                  deslogar o admin atual.
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc,
  query, where, getDocs, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Config Firebase (chaves públicas por design — segurança real
//    é feita pelas firestore.rules) ───────────────────────────────
export const FIREBASE_CFG = {
  apiKey:            "AIzaSyCI5oMXp9v5Y0gPBoZe4wBE7jR_QjDWku4",
  authDomain:        "fertratos.firebaseapp.com",
  projectId:         "fertratos",
  storageBucket:     "fertratos.firebasestorage.app",
  messagingSenderId: "372073605916",
  appId:             "1:372073605916:web:3078f1591caab253d4a8d9",
  measurementId:     "G-42NM186MEP",
};

// ── App principal ─────────────────────────────────────────────
export const app  = initializeApp(FIREBASE_CFG);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ── App secundário (usado em usuarios.js para criar contas
//    sem deslogar o admin atual) ────────────────────────────────
export const appB  = initializeApp(FIREBASE_CFG, 'secondary');
export const authB = getAuth(appB);

// ── Reexports do SDK (todos os módulos importam daqui em vez de
//    cada um abrir uma URL gstatic diferente) ────────────────────
export {
  // Firestore
  doc, getDoc, setDoc, collection, addDoc,
  query, where, getDocs, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot,
  // Auth
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
};
