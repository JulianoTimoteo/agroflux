// ═══════════════════════════════════════════════════════════════
// realtime.js — Sincronização Firestore (OS CAMPO - CORRIGIDO)
// ═══════════════════════════════════════════════════════════════

import {
  db, doc, setDoc, addDoc, collection, query, where, getDocs,
  updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from './firebase-init.js';
import { S, LS } from './state.js';
import {
  syncUI, toast, loading, playSuccessSound, customConfirm,
  norm, todayBR, tc, getOperacaoAgricola, getCollectionForOperation
} from './utils.js';
import { refreshAll } from './refresh.js';

// ── Detach listeners ativos ────────────────────────────────
export function detachListeners() {
  if (S.listeners && S.listeners.length) {
    const activeListeners = [...S.listeners];
    S.listeners = [];
    activeListeners.forEach(unsub => {
      if (typeof unsub === 'function') {
        try { unsub(); } catch(e) { }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════
// 1. ADMIN_CONFIG
// ═══════════════════════════════════════════════════════════

export function subscribeAdminConfig() {
  const configs = [
    { name: 'equipamentos', key: 'equipamentos' },
    { name: 'rendimentos', key: 'rendimentos' },
    { name: 'planoHoras', key: 'planoHoras' },
    { name: 'operacoesAgricolas', key: 'operacoesAgricolas' },
    { name: 'team_configs', key: 'teamConfigs' },
    { name: 'teamMetadata', key: 'teamMetadata' }
  ];

  configs.forEach(({ name, key }) => {
    const docRef = doc(db, 'admin_config', name);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        if (key === 'teamConfigs') {
          S.teamConfigs = data.config || {};
          LS.set('teamConfigs', S.teamConfigs);
        } else if (key === 'teamMetadata') {
          S.teamMetadata = data.items || [];
          LS.set('teamMetadata', S.teamMetadata);
        } else {
          S[key] = data.items || [];
          LS.set(key, S[key]);
        }
        
        if (key === 'operacoesAgricolas') {
          _normalizeOps();
        }
        
        console.log(`[Realtime] ${name} atualizado`);
        refreshAll();
      }
    }, (err) => {
      if (err?.code !== 'permission-denied') {
        console.warn(`[Realtime] Erro em ${name}:`, err?.code);
      }
    });
    S.listeners.push(unsub);
  });
}

// ═══════════════════════════════════════════════════════════
// 2. REGISTROS (TODOS OS DIAS, NÃO APENAS HOJE)
// ═══════════════════════════════════════════════════════════

const TEAM_TO_COLLECTION = {
  'herbicida': 'herbicida',
  'tratos': 'tratos',
  'biomassa': 'biomassa',
  'preparo': 'preparo',
  'linhaamarela': 'linhaamarela',
  'fertirrigacao': 'fertirrigacao'
};

export function subscribeAllRecords() {
  const userAbas = S.session?.Abas || [];
  const nivel = S.session?.Nivel || '';
  const isPrivileged = ['master', 'administrador', 'admin'].includes(nivel.toLowerCase());
  
  const allowedTeams = isPrivileged
    ? Object.keys(TEAM_TO_COLLECTION)
    : userAbas.filter(aba => TEAM_TO_COLLECTION[aba.toLowerCase()]);
  
  for (const team of allowedTeams) {
    const colName = TEAM_TO_COLLECTION[team.toLowerCase()];
    if (!colName) continue;
    
    // 🔥 CORREÇÃO: NÃO filtrar por data - pegar TODOS os registros
    // ou filtrar por período maior (últimos 30 dias)
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const dataLimite = trintaDiasAtras.toLocaleDateString('pt-BR');
    
    const q = query(
      collection(db, colName),
      where('data', '>=', dataLimite)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      // 🔥 CRÍTICO: Limpa e recarrega TODOS os registros da coleção
      const batchReal = {};
      
      snapshot.forEach(doc => {
        const r = doc.data();
        const key = `${String(r.codOperacao).trim()}|${(r.modelo || '').trim()}|${String(r.frota).trim()}|${r.data}`;
        batchReal[key] = {
          id: doc.id,
          col: colName,
          horas: parseFloat(r.horasReal) || 0,
          haDia: parseFloat(r.haDia) || 0,
          motivo: r.motivo || '',
          acaoCorretiva: r.acao || '',
          obs: r.observacao || '',
          extras: r.extras || {},
          extrasPlan: r.extrasPlan || {},
          data: r.data
        };
      });
      
      // 🔥 Mantém registros de outras coleções, mas atualiza esta
      Object.keys(S.realizados).forEach(k => {
        if (S.realizados[k]?.col === colName) delete S.realizados[k];
      });
      Object.assign(S.realizados, batchReal);
      
      const uid = S.session?.uid;
      if (uid) LS.set('realizados_' + uid, S.realizados);
      
      console.log(`[Realtime] ${colName} atualizado: ${snapshot.size} registros`);
      refreshAll();
    }, (err) => {
      console.warn(`[Realtime] Erro em ${colName}:`, err?.code);
    });
    S.listeners.push(unsub);
  }
}

// ═══════════════════════════════════════════════════════════
// 3. USUÁRIOS
// ═══════════════════════════════════════════════════════════

export function subscribeUsuarios() {
  const nivel = S.session?.Nivel || '';
  const isPrivileged = ['master', 'administrador', 'admin'].includes(nivel.toLowerCase());
  
  if (!isPrivileged) return;
  
  const unsub = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
    S.usuarios = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
    LS.set('usuarios', S.usuarios);
    console.log(`[Realtime] Usuários atualizado: ${snapshot.size} registros`);
    refreshAll();
  }, (err) => {
    console.warn('[Realtime] Erro em usuários:', err?.code);
  });
  S.listeners.push(unsub);
}

// ═══════════════════════════════════════════════════════════
// 4. CARGA INICIAL
// ═══════════════════════════════════════════════════════════

export async function loadFromFirestore() {
  if (!navigator.onLine) {
    syncUI('', 'Offline — dados do cache');
    return;
  }
  
  syncUI('warn', 'Conectando...');
  detachListeners();
  
  const uid = S.session?.uid;
  if (uid) {
    const storedPend = LS.get('pendentes_' + uid);
    S.pendentes = Array.isArray(storedPend) ? storedPend : [];
  }
  
  S.realizados = {};
  
  try {
    subscribeAdminConfig();
    subscribeAllRecords();  // 🔥 Agora pega TODOS os registros
    subscribeUsuarios();
    
    syncUI('ok', 'Conectado');
    console.log('[Realtime] Todos os listeners iniciados');
    refreshAll();
  } catch (e) {
    console.error('[Realtime] Erro:', e);
    syncUI('err', 'Erro de conexão');
  }
}

// ═══════════════════════════════════════════════════════════
// 5. ESCRITA DIRETA
// ═══════════════════════════════════════════════════════════

export async function saveCampoRecord(record) {
  if (!navigator.onLine) {
    toast('Sem conexão. Tente novamente.', 'e');
    return false;
  }
  
  const colName = getCollectionForOperation(record.codOperacao);
  if (!colName) {
    toast('Erro: Operação não reconhecida.', 'e');
    return false;
  }
  
  loading(true, 'Salvando...');
  
  try {
    await addDoc(collection(db, colName), {
      ...record,
      extras: record.extras || {},
      operador: S.session?.Nome || 'Campo',
      syncedAt: new Date().toISOString(),
      createdAt: serverTimestamp()
    });
    
    toast('Registro salvo!', 's');
    playSuccessSound();
    return true;
  } catch (e) {
    console.error('[Save] Erro:', e);
    toast('Erro ao salvar: ' + (e.message || 'Verifique sua conexão'), 'e');
    return false;
  } finally {
    loading(false);
  }
}

export async function updateCampoRecord(col, docId, updates) {
  if (!navigator.onLine) {
    toast('Sem conexão.', 'e');
    return false;
  }
  
  loading(true, 'Atualizando...');
  try {
    await updateDoc(doc(db, col, docId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    toast('Registro atualizado!', 's');
    return true;
  } catch (e) {
    toast('Erro ao atualizar', 'e');
    return false;
  } finally {
    loading(false);
  }
}

export async function deleteCampoRecord(col, docId) {
  if (!navigator.onLine) {
    toast('Sem conexão.', 'e');
    return false;
  }
  
  const confirm = await customConfirm('Excluir', 'Tem certeza?', 'Excluir', 'Cancelar');
  if (!confirm) return false;
  
  loading(true, 'Excluindo...');
  try {
    await deleteDoc(doc(db, col, docId));
    toast('Registro excluído!', 's');
    return true;
  } catch (e) {
    toast('Erro ao excluir', 'e');
    return false;
  } finally {
    loading(false);
  }
}

export async function saveAdminConfig(type, items) {
  if (!navigator.onLine) {
    toast('Sem conexão.', 'e');
    return false;
  }
  try {
    await setDoc(doc(db, 'admin_config', type), { items, updatedAt: new Date().toISOString() });
    toast(`${type} salvo!`, 's');
    return true;
  } catch (e) {
    toast('Erro ao salvar', 'e');
    return false;
  }
}

export async function updateObs(col, docId, val) {
  if (!col || !docId) return;
  if (!navigator.onLine) {
    toast('Sem conexão.', 'e');
    return;
  }
  try {
    await updateDoc(doc(db, col, docId), { observacao: val });
    toast('Observação salva!', 's');
  } catch (e) {
    toast('Erro ao salvar', 'e');
  }
}

export function _normalizeOps() {
  if (!S.operacoesAgricolas || !S.operacoesAgricolas.length) return;
  
  S.operacoesAgricolas = S.operacoesAgricolas.map(o => {
    const cod = String(o.CodOperacao || o.cod || '');
    const rend = S.rendimentos?.find(r => String(r.CodOperacao) === cod) || {};
    const plan = S.planoHoras?.find(p => String(p.CdOperacao || p.CodOperacao) === cod) || {};
    
    return {
      CodOperacao: cod,
      Descricao: tc(o.Descricao || o.desc || rend.Descricao || plan.DeOperacao || ''),
      Equipe: tc(o.Equipe || o.equipe || 'Tratos'),
      Total: parseFloat(o.Total || o.total || rend.Rendimento || 1),
      HorasBase: parseFloat(o.HorasBase || plan.HorasBase || 3.95),
      Rendimento: parseFloat(o.Total || o.total || rend.Rendimento || 1),
      Turno: o.Turno || rend.Turno || '1',
      SubTurno: o.SubTurno || rend.SubTurno || null,
      TipoTrator: o.TipoTrator || rend.TipoTrator || 'Leve',
      UM: o.UM || rend.UM || 'há/h',
      extrasPlan: o.extrasPlan || rend.extrasPlan || {}
    };
  }).filter(o => o.CodOperacao);
}

export function startHourlySync() {
  const now = new Date();
  const msUntilNextHour = (60 - now.getMinutes()) * 60000 - (now.getSeconds() * 1000);
  
  setTimeout(() => {
    if (navigator.onLine && S.session) {
      loadFromFirestore();
    }
    setInterval(() => {
      if (navigator.onLine && S.session) {
        loadFromFirestore();
      }
    }, 3600000);
  }, msUntilNextHour);
}

export async function sincronizarCampo() {
  toast('Os registros são salvos automaticamente!', 'i');
}

export function syncNow() {
  if (navigator.onLine) {
    loadFromFirestore();
    toast('Dados atualizados!', 's');
  } else {
    toast('Sem conexão.', 'w');
  }
}

export function updateSyncTimerUI() {
  const now = new Date();
  const nextHour = (now.getHours() + 1) % 24;
  const timeStr = nextHour.toString().padStart(2, '0') + ':00';
  const elx = document.getElementById('nextSyncTime');
  if (elx) elx.textContent = timeStr;
}
