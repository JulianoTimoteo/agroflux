// ═══════════════════════════════════════════════════════════════
// realtime.js — Sincronização Firestore (onSnapshot + saves)
// ═══════════════════════════════════════════════════════════════

import {
  db, doc, setDoc, collection, addDoc, query, where, getDocs,
  updateDoc, onSnapshot
} from './firebase-init.js';
import { S, LS } from './state.js';
import {
  syncUI, toast, loading, playSuccessSound, customConfirm,
  norm, todayBR, tc, getOperacaoAgricola, getCollectionForOperation
} from './utils.js';
import { refreshAll } from './refresh.js';

// ── Detach listeners ativos antes de re-anexar ────────────────
export function detachListeners() {
  if (S.listeners && S.listeners.length) {
    S.listeners.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
    S.listeners = [];
  }
}

// ── Carga inicial: assina admin_config + registros do dia ─────
export async function loadFromFirestore(customDate = null) {
  if (!navigator.onLine) { syncUI('', 'Offline — dados locais'); return; }
  syncUI('warn', 'Sincronizando...');
  detachListeners();
  try {
    const collections = ['equipamentos', 'rendimentos', 'planoHoras', 'operacoesAgricolas', 'team_configs', 'teamMetadata'];
    for (const col of collections) {
      const unsub = onSnapshot(doc(db, 'admin_config', col), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (col === 'team_configs') { S.teamConfigs = data.config || {}; LS.set('teamConfigs', S.teamConfigs); }
          else if (col === 'teamMetadata') { S.teamMetadata = data.items || []; LS.set('teamMetadata', S.teamMetadata); }
          else { S[col] = data.items || []; LS.set(col, S[col]); }
          if (col === 'operacoesAgricolas') _normalizeOps();
          refreshAll();
        }
      }, (err) => {
        if (err.code !== 'permission-denied') console.warn(`[FB] Erro na configuração: ${col}`, err);
      });
      S.listeners.push(unsub);
    }
    if (S.session?.Nivel === 'master') await loadUsuarios();
    await loadTodayRecords(customDate);
    syncUI('ok', 'Conectado');
    refreshAll();
  } catch (e) {
    if (e.code !== 'permission-denied') console.error('[FB] Erro de carga:', e);
    syncUI('err', 'Erro Firebase');
  }
}

// ── Registros do dia (uma assinatura por equipe permitida) ────
export async function loadTodayRecords(customDate = null) {
  const targetDate = customDate || todayBR();
  if (customDate) S.realizados = {};

  const allCols = ['herbicida', 'tratos', 'biomassa', 'preparo', 'linhaamarela', 'fertirrigacao'];
  // AUTO-CORREÇÃO: Só assina coleções que o usuário tem permissão para ver (Abas)
  const allowedCols = S.session?.Nivel === 'master' ? allCols :
                      allCols.filter(c => S.session?.Abas?.includes(c));

  for (const col of allowedCols) {
    try {
      const q = query(collection(db, col), where('data', '==', String(targetDate)));
      const unsub = onSnapshot(q, (snap) => {
        const batchReal = {};
        snap.forEach(d => {
          const r = d.data();
          const key = `${String(r.codOperacao).trim()}|${(r.modelo || '').trim()}|${String(r.frota).trim()}`;
          batchReal[key] = {
            id: d.id, col: col,
            horas: parseFloat(r.horasReal) || 0,
            haDia: parseFloat(r.haDia) || 0,
            motivo: r.motivo || '',
            acaoCorretiva: r.acao || '',
            obs: r.observacao || '',
            extras: r.extras || {},
            extrasPlan: r.extrasPlan || {}
          };
        });
        S.realizados = { ...S.realizados, ...batchReal };
        LS.set('realizados', S.realizados);
        refreshAll();
      }, (err) => {
        if (err.code !== 'permission-denied') console.warn(`[FB] Erro nos registros: ${col}`, err);
      });
      S.listeners.push(unsub);
    } catch (e) { if (e.code !== 'permission-denied') console.warn('[FB] Carga falhou:', col, e); }
  }
}

// ── Carrega lista de usuários (apenas master) ─────────────────
export async function loadUsuarios() {
  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    S.usuarios = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
    LS.set('usuarios', S.usuarios);
  } catch (e) { console.warn('[FB] loadUsuarios:', e); }
}

// ── Normaliza operacoesAgricolas mesclando planoHoras+rendimentos
export function _normalizeOps() {
  if (!S.operacoesAgricolas) return;
  S.operacoesAgricolas = S.operacoesAgricolas.map(o => {
    const cod = String(o.CodOperacao || o.cod || '');
    const rend = S.rendimentos?.find(r => String(r.CodOperacao) === cod) || {};
    const plan = S.planoHoras?.find(p => String(p.CdOperacao || p.CodOperacao) === cod) || {};
    return {
      CodOperacao: cod,
      Descricao:   tc(o.Descricao || o.desc || rend.Descricao || plan.DeOperacao || ''),
      Equipe:      tc(o.Equipe || o.equipe || 'Tratos'),
      Total:       parseFloat(o.Total || o.total || rend.Rendimento || 1),
      HorasBase:   parseFloat(o.HorasBase || plan.HorasBase || 3.95),
      Rendimento:  parseFloat(o.Total || o.total || rend.Rendimento || 1),
      Turno:       o.Turno || rend.Turno || '1',
      SubTurno:    o.SubTurno || rend.SubTurno || null,
      TipoTrator:  o.TipoTrator || rend.TipoTrator || 'Leve',
      UM:          o.UM || rend.UM || 'há/h',
      extrasPlan:  o.extrasPlan || rend.extrasPlan || {}
    };
  }).filter(o => o.CodOperacao);
}

// ── Atualiza a label "Próxima atualização às HH:00" ───────────
export function updateSyncTimerUI() {
  const now = new Date();
  const nextHour = (now.getHours() + 1) % 24;
  const timeStr = nextHour.toString().padStart(2, '0') + ':00';
  const elx = document.getElementById('nextSyncTime');
  if (elx) elx.textContent = timeStr;
}

// ── Atualiza Observação COA inline (admin/master) ─────────────
export async function updateObs(col, docId, val) {
  if (!col || !docId) return;
  try {
    await updateDoc(doc(db, col, docId), { observacao: val });
    toast('Observação COA salva!', 's');
  } catch (e) {
    console.error('[COA Update]', e);
    toast('Erro ao salvar Observação COA.', 'e');
  }
}

// ── Persistência de admin_config/{type} ───────────────────────
export async function saveAdminConfig(type, items) {
  try {
    await setDoc(doc(db, 'admin_config', type), { items, updatedAt: new Date().toISOString() });
  } catch (e) { console.warn('[FB] save', type, e); }
}

// ── Sincroniza pendentes da equipe ativa em Campo ─────────────
export async function sincronizarCampo() {
  const selectedIds = Array.from(document.querySelectorAll('.pend-check:checked')).map(cb => Number(cb.dataset.id));

  const teamPendentes = S.pendentes.filter(r => {
    const op = getOperacaoAgricola(r.codOperacao);
    return op && norm(op.Equipe) === norm(S.campoEquipe);
  });

  if (teamPendentes.length === 0) { toast('Não há registros pendentes para esta equipe.', 'w'); return; }

  let toSync = [];
  let msg = '';

  if (selectedIds.length > 0) {
    toSync = teamPendentes.filter(r => selectedIds.includes(r.id));
    msg = `Sincronizar os ${toSync.length} registros selecionados?`;
  } else {
    toSync = teamPendentes;
    msg = `Sincronizar TODOS os ${toSync.length} registros pendentes desta equipe?\n\nVocê enviará todos os seus apontamentos!!`;
  }

  const ok = await customConfirm('Sincronizar', msg, toSync.length === teamPendentes.length ? 'Sincronizar Tudo' : 'Sincronizar', 'Cancelar');
  if (!ok) return;

  if (!navigator.onLine) { toast('Sem conexão com a internet.', 'e'); return; }
  loading(true, `Sincronizando ${toSync.length} registros...`);
  try {
    for (const r of [...toSync]) {
      await _enviarRegistroUnico(r);
      S.pendentes = S.pendentes.filter(p => p.id !== r.id);
    }
    LS.set('pendentes', S.pendentes);
    await loadTodayRecords();
    toast('Sincronização concluída!', 's');
    playSuccessSound();
    refreshAll();
  } catch (e) { toast('Erro: ' + e.message, 'e'); }
  finally { loading(false); }
}

export async function _enviarRegistroUnico(r) {
  const colName = getCollectionForOperation(r.codOperacao);
  await addDoc(collection(db, colName), {
    ...r,
    extras: r.extras || {},
    extrasPlan: r.extrasPlan || {},
    operador: r.operador || S.session?.Nome || 'Campo',
    syncedAt: new Date().toISOString()
  });
}

// ── Sync horária (alinhada à hora cheia) ──────────────────────
export function startHourlySync() {
  const now = new Date();
  const msUntilNextHour = (60 - now.getMinutes()) * 60000 - (now.getSeconds() * 1000);

  setTimeout(() => {
    if (navigator.onLine && S.session) {
      loadFromFirestore();
      updateSyncTimerUI();
    }
    setInterval(() => {
      if (navigator.onLine && S.session) {
        loadFromFirestore();
        updateSyncTimerUI();
      }
    }, 3600000);
  }, msUntilNextHour);
}

// ── Sync sob demanda (botão) ──────────────────────────────────
export function syncNow() {
  if (navigator.onLine) loadFromFirestore().then(() => toast('Sincronizado!', 's'));
  else toast('Sem conexão', 'w');
}
