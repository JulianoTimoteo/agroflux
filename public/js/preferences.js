// ═══════════════════════════════════════════════════════════════
// preferences.js — Estado cross-device via Firestore
// ═══════════════════════════════════════════════════════════════
//
// ARQUITETURA DE PENDENTES (solução definitiva):
//
//   Cada pendente é um DOCUMENTO SEPARADO em subcoleção:
//     pendentes_campo/{uid}/items/{itemId}
//
//   Isso elimina conflito de merge — cada dispositivo só escreve
//   no seu próprio documento; nunca sobrescreve o de outro.
//
//   Registros criados OFFLINE ficam em localStorage e também em:
//     pending_temp/{uid}/items/{itemId}
//   Quando ficar online, são migrados automaticamente para
//   pendentes_campo e apagados de pending_temp.
//
//   onSnapshot monitora pendentes_campo/{uid}/items em TEMPO REAL:
//   qualquer dispositivo que salva um pendente aparece em TODOS
//   os outros imediatamente — sem relogar.
//
// PREFERÊNCIAS SIMPLES (aba, equipe, rascunho):
//   Continuam em user_preferences/{uid} com merge parcial.
// ═══════════════════════════════════════════════════════════════

import {
  db, doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, onSnapshot
} from './firebase-init.js';
import { S, LS } from './state.js';

// ── Listener ativo ────────────────────────────────────────────
let _pendentesUnsub = null;

// ── Referências de coleção ────────────────────────────────────
const _pendRef  = uid => collection(db, 'pendentes_campo', uid, 'items');
const _tempRef  = uid => collection(db, 'pending_temp', uid, 'items');
const _pendDoc  = (uid, id) => doc(db, 'pendentes_campo', uid, 'items', String(id));
const _tempDoc  = (uid, id) => doc(db, 'pending_temp', uid, 'items', String(id));

// ═══════════════════════════════════════════════════════════════
// PREFERÊNCIAS SIMPLES
// ═══════════════════════════════════════════════════════════════

export async function saveUserPrefs(prefs) {
  const uid = S.session?.uid;
  if (!uid) return;
  const local = LS.get('prefs_' + uid, {});
  LS.set('prefs_' + uid, { ...local, ...prefs });
  if (navigator.onLine) {
    try {
      await setDoc(
        doc(db, 'user_preferences', uid),
        { ...prefs, _updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) { console.warn('[Prefs] saveUserPrefs falhou:', e?.code); }
  }
}

export async function loadUserPrefs(uid) {
  if (!uid) return {};
  if (navigator.onLine) {
    try {
      const snap = await getDoc(doc(db, 'user_preferences', uid));
      if (snap.exists()) {
        const data = snap.data();
        LS.set('prefs_' + uid, data);
        return data;
      }
    } catch (e) { console.warn('[Prefs] loadUserPrefs falhou:', e?.code); }
  }
  return LS.get('prefs_' + uid, {});
}

// ═══════════════════════════════════════════════════════════════
// PENDENTES — Um documento por pendente
// ═══════════════════════════════════════════════════════════════

// ── Salva/atualiza um único pendente ──────────────────────────
export async function addPendenteCloud(pend, uid) {
  if (!uid || !pend?.id) return;

  let finalPend = { ...pend };

  if (navigator.onLine) {
    try {
      const existingSnap = await getDoc(_pendDoc(uid, finalPend.id));
      if (existingSnap.exists()) {
        const existing = existingSnap.data();
        // Colisão de ID com dados diferentes (registro de outro dispositivo)?
        // Gera um novo ID único para não sobrescrever
        const isSameRecord = existing.frota === finalPend.frota
          && existing.codOperacao === finalPend.codOperacao
          && existing.data === finalPend.data;
        if (!isSameRecord) {
          finalPend = {
            ...finalPend,
            id: `${uid}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
          };
        }
      }
      await setDoc(_pendDoc(uid, finalPend.id), { ...finalPend, _savedAt: new Date().toISOString() });
      _removeOfflineQueue(uid, pend.id);
      // Se o ID foi remapeado, atualiza localmente
      if (finalPend.id !== pend.id) {
        _removeLocalPend(pend.id, uid);
      }
      _upsertLocalPend(finalPend, uid);
      // Sincroniza S.pendentes
      if (Array.isArray(S.pendentes)) {
        const idx = S.pendentes.findIndex(p => String(p.id) === String(pend.id));
        if (idx >= 0) S.pendentes[idx] = finalPend;
        else if (finalPend.id !== pend.id) S.pendentes.push(finalPend);
      }
    } catch (e) {
      console.warn('[Prefs] addPendenteCloud falhou:', e?.code);
      _upsertLocalPend(finalPend, uid);
      _addOfflineQueue(uid, finalPend.id);
    }
  } else {
    _upsertLocalPend(finalPend, uid);
    _addOfflineQueue(uid, finalPend.id);
  }
}

// ── Remove um único pendente ──────────────────────────────────
export async function removePendenteCloud(pendId, uid) {
  if (!uid || !pendId) return;
  _removeLocalPend(pendId, uid);
  _removeOfflineQueue(uid, pendId);

  if (!navigator.onLine) return;
  try {
    await deleteDoc(_pendDoc(uid, pendId));
    await deleteDoc(_tempDoc(uid, pendId)).catch(() => {});
  } catch (e) { console.warn('[Prefs] removePendenteCloud falhou:', e?.code); }
}

// ── Carrega TODOS os pendentes na inicialização ───────────────
// Firestore + pending_temp + localStorage — todos unidos
export async function loadAllPendentesCloud(uid) {
  if (!uid) return LS.get('pendentes_' + uid, []);
  const local = LS.get('pendentes_' + uid, []);
  if (!navigator.onLine) return local;

  try {
    // 1. Busca da coleção principal
    const snap = await getDocs(_pendRef(uid));
    const cloud = snap.docs.map(d => d.data());
    const cloudIds = new Set(cloud.map(p => String(p.id)));

    // 2. Busca de pending_temp (migração de offline antigo)
    let tempItems = [];
    try {
      const tempSnap = await getDocs(_tempRef(uid));
      tempItems = tempSnap.docs.map(d => ({ doc: d, data: d.data() }));
    } catch (_) {}

    // Migra pending_temp → pendentes_campo
    for (const { doc: dRef, data: p } of tempItems) {
      if (!cloudIds.has(String(p.id))) {
        try {
          await setDoc(_pendDoc(uid, p.id), { ...p, _savedAt: new Date().toISOString() });
          cloud.push(p);
          cloudIds.add(String(p.id));
        } catch (_) {}
      }
      try { await deleteDoc(dRef.ref); } catch (_) {}
    }

    // 3. Sobe pendentes locais que ainda não estão na nuvem.
    //    Cada item é pré-adicionado à fila offline ANTES da tentativa.
    //    Se o upload falhar, permanece na fila para ser retentado em flushOfflinePendentes.
    //    Se o upload tiver sucesso, é removido da fila.
    const onlyLocal = local.filter(p => !cloudIds.has(String(p.id)));
    for (const p of onlyLocal) {
      // Pré-adiciona à fila offline: se falhar abaixo, será retentado
      _addOfflineQueue(uid, String(p.id));
      let finalP = { ...p };
      try {
        const existingSnap = await getDoc(_pendDoc(uid, p.id)).catch(() => null);
        if (existingSnap && existingSnap.exists()) {
          const ex = existingSnap.data();
          const isSame = ex.frota === p.frota && ex.codOperacao === p.codOperacao && ex.data === p.data;
          if (!isSame) {
            // Remapeia para ID único
            finalP = {
              ...p,
              id: `${uid}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
            };
          }
        }
        await setDoc(_pendDoc(uid, finalP.id), { ...finalP, _savedAt: new Date().toISOString() });
        cloud.push(finalP);
        // Upload OK: remove da fila offline (ID original e remapeado)
        _removeOfflineQueue(uid, String(p.id));
        if (finalP.id !== p.id) _removeOfflineQueue(uid, String(finalP.id));
      } catch (e) {
        console.warn('[Prefs] Falha ao subir pendente local:', finalP.id, e?.code || e);
        // Item permanece na fila offline para retry; mostra localmente
        cloud.push(finalP);
      }
    }

    const merged = cloud;
    LS.set('pendentes_' + uid, merged);
    // NÃO limpa toda a fila offline aqui — só as bem-sucedidas foram removidas acima.
    return merged;
  } catch (e) {
    console.warn('[Prefs] loadAllPendentesCloud falhou:', e?.code);
    return local;
  }
}

// ── Listener em tempo real ────────────────────────────────────
export function subscribePendentes(uid, onUpdate) {
  if (!uid) return;
  if (_pendentesUnsub) { _pendentesUnsub(); _pendentesUnsub = null; }
  if (!navigator.onLine) return;

  try {
    _pendentesUnsub = onSnapshot(
      _pendRef(uid),
      (snap) => {
        const cloudItems = snap.docs.map(d => d.data());
        const cloudIds = new Set(cloudItems.map(p => String(p.id)));

        // Só adiciona itens que estão na fila offline EXPLÍCITA (criados sem internet)
        // e que ainda não chegaram ao Firestore.
        // NÃO mistura com todo o localStorage — isso causava divergência entre browsers.
        const offlineIds = LS.get('pend_offline_' + uid, []);
        const onlyOffline = offlineIds.length > 0
          ? LS.get('pendentes_' + uid, []).filter(
              p => offlineIds.includes(String(p.id)) && !cloudIds.has(String(p.id))
            )
          : [];

        const merged = [...cloudItems, ...onlyOffline];
        S.pendentes = merged;
        LS.set('pendentes_' + uid, merged);
        if (typeof onUpdate === 'function') onUpdate(merged);
      },
      (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('[Prefs] subscribePendentes erro:', err?.code);
        }
      }
    );
  } catch (e) {
    console.warn('[Prefs] subscribePendentes init falhou:', e?.code);
  }
}

// ── Para o listener (chamado no logout) ──────────────────────
export function unsubscribePendentes() {
  if (_pendentesUnsub) { _pendentesUnsub(); _pendentesUnsub = null; }
}

// ── Envia pendentes offline acumulados quando ficar online ────
export async function flushOfflinePendentes(uid) {
  if (!uid || !navigator.onLine) return;
  const offlineIds = LS.get('pend_offline_' + uid, []);
  if (!offlineIds.length) return;
  const local = LS.get('pendentes_' + uid, []);
  let ok = 0;
  for (const id of [...offlineIds]) {
    const p = local.find(x => String(x.id) === String(id));
    if (p) {
      try {
        await setDoc(_pendDoc(uid, p.id), { ...p, _savedAt: new Date().toISOString() });
        ok++;
        _removeOfflineQueue(uid, id);
      } catch (_) {}
    }
  }
  if (ok > 0) console.log(`[Prefs] ${ok} pendentes offline enviados.`);
}

// ── Compatibilidade legada (realtime.js chama savePendentesCloud)
export async function savePendentesCloud(pendentes, uid) {
  if (!uid || !Array.isArray(pendentes)) return;
  for (const p of pendentes) await addPendenteCloud(p, uid);
  // Remove do Firestore itens excluídos localmente
  if (navigator.onLine) {
    try {
      const snap = await getDocs(_pendRef(uid));
      const keepIds = new Set(pendentes.map(p => String(p.id)));
      for (const d of snap.docs) {
        if (!keepIds.has(d.id)) await deleteDoc(d.ref).catch(() => {});
      }
    } catch (_) {}
  }
}

// ── Rascunho do Campo ─────────────────────────────────────────
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
    } catch (e) { console.warn('[Prefs] saveDraftCloud falhou:', e?.code); }
  }
}

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
    } catch (_) {}
  }
}

// ── Helpers internos ──────────────────────────────────────────
function _upsertLocalPend(pend, uid) {
  const list = LS.get('pendentes_' + uid, []);
  const idx = list.findIndex(p => String(p.id) === String(pend.id));
  if (idx >= 0) list[idx] = pend; else list.push(pend);
  LS.set('pendentes_' + uid, list);
}

function _removeLocalPend(pendId, uid) {
  const list = LS.get('pendentes_' + uid, []).filter(p => String(p.id) !== String(pendId));
  LS.set('pendentes_' + uid, list);
}

function _addOfflineQueue(uid, pendId) {
  const q = LS.get('pend_offline_' + uid, []);
  if (!q.includes(String(pendId))) { q.push(String(pendId)); LS.set('pend_offline_' + uid, q); }
}

function _removeOfflineQueue(uid, pendId) {
  const q = LS.get('pend_offline_' + uid, []).filter(id => id !== String(pendId));
  LS.set('pend_offline_' + uid, q);
}
