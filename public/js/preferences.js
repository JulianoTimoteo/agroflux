// ═══════════════════════════════════════════════════════════════
// preferences.js — Preferências de usuário cross-device via Firestore
// ═══════════════════════════════════════════════════════════════
// Persiste no Firestore (coleção user_preferences/{uid}) tudo que
// precisa aparecer igual em qualquer dispositivo onde o usuário logar:
//   - activeTab   : última aba ativa
//   - campoEquipe : equipe selecionada na aba Campo
//   - dashEquipe  : equipe selecionada no Dashboard
//   - hbEquipe    : equipe selecionada na tabela consolidada
//   - pendentes   : registros pendentes de sincronização
//   - campoDraft  : rascunho parcial do formulário de Campo
//
// Estratégia: salva localmente (LS) primeiro (rápido e offline),
// depois replica no Firestore em background. Na leitura, busca do
// Firestore e atualiza o LS como cache.
// ═══════════════════════════════════════════════════════════════

import { db, doc, getDoc, setDoc } from './firebase-init.js';
import { S, LS } from './state.js';

// ── Salva preferências (merge parcial) ───────────────────────
export async function saveUserPrefs(prefs) {
  const uid = S.session?.uid;
  if (!uid) return;

  // 1. Persistência local imediata
  const local = LS.get('prefs_' + uid, {});
  LS.set('prefs_' + uid, { ...local, ...prefs });

  // 2. Replica no Firestore em background (não bloqueia UI)
  if (navigator.onLine) {
    try {
      await setDoc(
        doc(db, 'user_preferences', uid),
        { ...prefs, _updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) {
      // Falha silenciosa — já está salvo localmente
      console.warn('[Prefs] Firestore write falhou, usando cache local', e?.code);
    }
  }
}

// ── Carrega preferências (Firestore > localStorage > padrão) ──
export async function loadUserPrefs(uid) {
  if (!uid) return {};

  // Tenta Firestore primeiro
  if (navigator.onLine) {
    try {
      const snap = await getDoc(doc(db, 'user_preferences', uid));
      if (snap.exists()) {
        const data = snap.data();
        LS.set('prefs_' + uid, data); // sincroniza cache local
        return data;
      }
    } catch (e) {
      console.warn('[Prefs] Firestore read falhou, usando cache local', e?.code);
    }
  }

  // Fallback: localStorage
  return LS.get('prefs_' + uid, {});
}

// ── Salva pendentes no Firestore (cross-device) ───────────────
export async function savePendentesCloud(pendentes, uid) {
  if (!uid) return;
  // Salva localmente sempre
  LS.set('pendentes_' + uid, pendentes);
  // Replica no Firestore se online
  if (navigator.onLine) {
    try {
      await setDoc(
        doc(db, 'user_preferences', uid),
        { pendentes, _updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) {
      console.warn('[Prefs] Pendentes cloud save falhou', e?.code);
    }
  }
}

// ── Carrega pendentes do Firestore ───────────────────────────
export async function loadPendentesCloud(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'user_preferences', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.pendentes) && data.pendentes.length > 0) {
        return data.pendentes;
      }
    }
  } catch (e) {
    console.warn('[Prefs] Pendentes cloud load falhou', e?.code);
  }
  return null;
}

// ── Salva rascunho do Campo no Firestore ──────────────────────
export async function saveDraftCloud(draft, uid) {
  if (!uid) return;
  LS.set('draft_campo_' + uid, draft);
  if (navigator.onLine) {
    try {
      await setDoc(
        doc(db, 'user_preferences', uid),
        { campoDraft: draft, _updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) {
      console.warn('[Prefs] Draft cloud save falhou', e?.code);
    }
  }
}

// ── Remove rascunho do Firestore ──────────────────────────────
export async function clearDraftCloud(uid) {
  if (!uid) return;
  LS.rm('draft_campo_' + uid);
  if (navigator.onLine) {
    try {
      await setDoc(
        doc(db, 'user_preferences', uid),
        { campoDraft: null, _updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) { /* silencioso */ }
  }
}
