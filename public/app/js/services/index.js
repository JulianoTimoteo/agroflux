// ═══════════════════════════════════════════════════════════════
// services/index.js — Acesso a dados (única fonte: Firebase)
// ═══════════════════════════════════════════════════════════════
// Firebase é a ÚNICA base de dados. O armazenamento local é
// apenas cache e fila offline — nunca substituto.
// ═══════════════════════════════════════════════════════════════

export { app, auth, db, FIREBASE_CFG } from '../firebase-init.js';

// Fila offline + preferências cross-device
export {
  saveUserPrefs, loadUserPrefs,
  addPendenteCloud, subscribePendentes,
} from '../preferences.js';

// Estado de conexão
export { CONN, connState, onConnChange, setConnState, initConnection } from './connection.js';
