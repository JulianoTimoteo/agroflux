// ═══════════════════════════════════════════════════════════════
// realtime.js — Sincronização Firestore (estilo OS CAMPO)
// ═══════════════════════════════════════════════════════════════
//
// ARQUITETURA SIMPLIFICADA:
//
//   🔥 FIRESTORE = ÚNICA FONTE DE VERDADE
//   
//   onSnapshot em TEMPO REAL para:
//     1. admin_config/* → equipamentos, rendimentos, etc.
//     2. Coleções por equipe → registros do dia/mês
//     3. Usuários → lista completa (master)
//
//   REGRAS:
//     1. ONLINE → dados vêm do Firestore via onSnapshot
//     2. OFFLINE → ÚLTIMA VERSÃO conhecida via cache
//     3. Escrita → addDoc/setDoc direto no Firestore
//     4. SEM FILA OFFLINE → se offline, mostra erro
//     5. SEM BOTÃO "Sincronizar" → automático
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

// ── Detach listeners ativos antes de re-anexar ────────────────
export function detachListeners() {
  if (S.listeners && S.listeners.length) {
    const activeListeners = [...S.listeners];
    S.listeners = [];
    activeListeners.forEach(unsub => {
      if (typeof unsub === 'function') {
        try { unsub(); } catch(e) { /* silencia */ }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. ADMIN_CONFIG — Configurações do sistema (onSnapshot)
// ═══════════════════════════════════════════════════════════════

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
        
        console.log(`[Realtime] ${name} atualizado via Firestore`);
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

// ═══════════════════════════════════════════════════════════════
// 2. REGISTROS DO DIA (onSnapshot por equipe)
// ═══════════════════════════════════════════════════════════════

// Mapeamento de equipe → nome da coleção no Firestore
const TEAM_TO_COLLECTION = {
  'herbicida': 'herbicida',
  'tratos': 'tratos',
  'biomassa': 'biomassa',
  'preparo': 'preparo',
  'linhaamarela': 'linhaamarela',
  'fertirrigacao': 'fertirrigacao'
};

export function subscribeTeamRecords(customDate = null) {
  const targetDate = customDate || todayBR();
  
  // Determina quais coleções o usuário pode ver
  const userAbas = S.session?.Abas || [];
  const nivel = S.session?.Nivel || '';
  const isPrivileged = ['master', 'administrador', 'admin'].includes(nivel.toLowerCase());
  
  const allowedTeams = isPrivileged
    ? Object.keys(TEAM_TO_COLLECTION)
    : userAbas.filter(aba => TEAM_TO_COLLECTION[aba.toLowerCase()]);
  
  for (const team of allowedTeams) {
    const colName = TEAM_TO_COLLECTION[team.toLowerCase()];
    if (!colName) continue;
    
    const q = query(
      collection(db, colName),
      where('data', '==', String(targetDate))
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const batchReal = {};
      
      snapshot.forEach(doc => {
        const r = doc.data();
        const key = `${String(r.codOperacao).trim()}|${(r.modelo || '').trim()}|${String(r.frota).trim()}`;
        batchReal[key] = {
          id: doc.id,
          col: colName,
          horas: parseFloat(r.horasReal) || 0,
          haDia: parseFloat(r.haDia) || 0,
          motivo: r.motivo || '',
          acaoCorretiva: r.acao || '',
          obs: r.observacao || '',
          extras: r.extras || {},
          extrasPlan: r.extrasPlan || {}
        };
      });
      
      // Remove registros antigos DESTA coleção antes de inserir novos
      Object.keys(S.realizados).forEach(k => {
        if (S.realizados[k]?.col === colName) delete S.realizados[k];
      });
      Object.assign(S.realizados, batchReal);
      
      // Atualiza cache (apenas para leitura offline)
      const uid = S.session?.uid;
      if (uid) LS.set('realizados_' + uid, S.realizados);
      
      console.log(`[Realtime] ${colName} atualizado: ${snapshot.size} registros`);
      refreshAll();
    }, (err) => {
      if (err?.code !== 'permission-denied') {
        console.warn(`[Realtime] Erro em ${colName}:`, err?.code);
      }
    });
    S.listeners.push(unsub);
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. USUÁRIOS (apenas para master)
// ═══════════════════════════════════════════════════════════════

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
    if (err?.code !== 'permission-denied') {
      console.warn('[Realtime] Erro em usuários:', err?.code);
    }
  });
  S.listeners.push(unsub);
}

// ═══════════════════════════════════════════════════════════════
// 4. CARGA INICIAL (inicia todos os listeners)
// ═══════════════════════════════════════════════════════════════

export async function loadFromFirestore(customDate = null) {
  if (!navigator.onLine) {
    syncUI('', 'Offline — dados do cache');
    return;
  }
  
  syncUI('warn', 'Conectando...');
  
  // Remove listeners antigos
  detachListeners();
  
  // Restaura pendentes do cache (apenas para visualização)
  const uid = S.session?.uid;
  if (uid) {
    const storedPend = LS.get('pendentes_' + uid);
    if (Array.isArray(storedPend) && storedPend.length > 0) {
      S.pendentes = storedPend;
    } else {
      S.pendentes = [];
    }
  }
  
  // Limpa realizados para receber dados frescos
  S.realizados = {};
  
  try {
    // Inicia listeners
    subscribeAdminConfig();
    subscribeTeamRecords(customDate);
    subscribeUsuarios();
    
    syncUI('ok', 'Conectado');
    console.log('[Realtime] Todos os listeners iniciados');
    refreshAll();
  } catch (e) {
    if (e?.code !== 'permission-denied') {
      console.error('[Realtime] Erro ao iniciar listeners:', e);
    }
    syncUI('err', 'Erro de conexão');
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. ESCRITA DIRETA NO FIRESTORE (sem fila)
// ═══════════════════════════════════════════════════════════════

// Salva um registro de campo diretamente no Firestore
export async function saveCampoRecord(record) {
  if (!navigator.onLine) {
    toast('Sem conexão com a internet. Tente novamente quando estiver online.', 'e');
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
    
    toast('Registro salvo com sucesso!', 's');
    playSuccessSound();
    return true;
  } catch (e) {
    console.error('[Save] Erro ao salvar:', e);
    toast('Erro ao salvar registro: ' + (e.message || 'Verifique sua conexão'), 'e');
    return false;
  } finally {
    loading(false);
  }
}

// Atualiza um registro existente
export async function updateCampoRecord(col, docId, updates) {
  if (!navigator.onLine) {
    toast('Sem conexão com a internet.', 'e');
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
    console.error('[Update] Erro:', e);
    toast('Erro ao atualizar registro', 'e');
    return false;
  } finally {
    loading(false);
  }
}

// Remove um registro
export async function deleteCampoRecord(col, docId) {
  if (!navigator.onLine) {
    toast('Sem conexão com a internet.', 'e');
    return false;
  }
  
  const confirm = await customConfirm('Excluir', 'Tem certeza que deseja excluir este registro?', 'Excluir', 'Cancelar');
  if (!confirm) return false;
  
  loading(true, 'Excluindo...');
  
  try {
    await deleteDoc(doc(db, col, docId));
    toast('Registro excluído!', 's');
    return true;
  } catch (e) {
    console.error('[Delete] Erro:', e);
    toast('Erro ao excluir registro', 'e');
    return false;
  } finally {
    loading(false);
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. ADMIN_CONFIG — Salvar configurações
// ═══════════════════════════════════════════════════════════════

export async function saveAdminConfig(type, items) {
  if (!navigator.onLine) {
    toast('Sem conexão para salvar configurações.', 'e');
    return false;
  }
  
  try {
    await setDoc(doc(db, 'admin_config', type), { 
      items, 
      updatedAt: new Date().toISOString() 
    });
    toast(`${type} salvo com sucesso!`, 's');
    return true;
  } catch (e) {
    console.warn('[FB] saveAdminConfig erro:', e);
    toast('Erro ao salvar configuração', 'e');
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 7. OBSERVAÇÃO COA (inline)
// ═══════════════════════════════════════════════════════════════

export async function updateObs(col, docId, val) {
  if (!col || !docId) return;
  if (!navigator.onLine) {
    toast('Sem conexão para salvar observação.', 'e');
    return;
  }
  
  try {
    await updateDoc(doc(db, col, docId), { observacao: val });
    toast('Observação COA salva!', 's');
  } catch (e) {
    console.error('[COA Update]', e);
    toast('Erro ao salvar Observação COA.', 'e');
  }
}

// ═══════════════════════════════════════════════════════════════
// 8. NORMALIZAÇÃO DAS OPERAÇÕES AGRÍCOLAS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// 9. SINCRONIZAÇÃO AGENDADA (apenas para atualizar data)
// ═══════════════════════════════════════════════════════════════

export function startHourlySync() {
  const now = new Date();
  const msUntilNextHour = (60 - now.getMinutes()) * 60000 - (now.getSeconds() * 1000);
  
  setTimeout(() => {
    if (navigator.onLine && S.session) {
      // Recarrega apenas para mudar a data (se necessário)
      console.log('[Sync] Sincronização automática da hora cheia');
      loadFromFirestore();
    }
    setInterval(() => {
      if (navigator.onLine && S.session) {
        loadFromFirestore();
      }
    }, 3600000);
  }, msUntilNextHour);
}

// ═══════════════════════════════════════════════════════════════
// 10. COMPATIBILIDADE (removido sincronizarCampo)
// ═══════════════════════════════════════════════════════════════

// NOTA: A função sincronizarCampo foi REMOVIDA porque agora os registros
// são salvos DIRETAMENTE no Firestore via saveCampoRecord().
// Não existe mais o conceito de "pendentes" como fila offline.

// Função vazia para manter compatibilidade com código legado
export async function sincronizarCampo() {
  toast('Os registros agora são salvos automaticamente!', 'i');
}

// Função vazia para compatibilidade
export function syncNow() {
  if (navigator.onLine) {
    loadFromFirestore();
    toast('Dados atualizados!', 's');
  } else {
    toast('Sem conexão com a internet.', 'w');
  }
}

// Atualiza a label "Próxima atualização"
export function updateSyncTimerUI() {
  const now = new Date();
  const nextHour = (now.getHours() + 1) % 24;
  const timeStr = nextHour.toString().padStart(2, '0') + ':00';
  const elx = document.getElementById('nextSyncTime');
  if (elx) elx.textContent = timeStr;
}
