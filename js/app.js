// ═══════════════════════════════════════════════════════════════
// app.js — Entry point (boot do PWA AgroFlux)
// ═══════════════════════════════════════════════════════════════
//
// ARQUITETURA SIMPLIFICADA (estilo OS CAMPO):
//
//   1. Importa todos os módulos
//   2. Expõe window.HT com TODAS as funções (onclicks do HTML)
//   3. Inicializa listeners globais (PWA, online/offline, modais, auth)
//   4. Registra Service Worker
//
//   IMPORTANTE: NÃO há mais botão "Sincronizar" — os dados são
//   atualizados em tempo real via onSnapshot (realtime.js)
// ═══════════════════════════════════════════════════════════════

// ── Estado global ─────────────────────────────────────────────
import { S } from './state.js';

// ── Utils (UI helpers, formatadores, modais) ──────────────────
import {
  el, gv, sv, txt, syncUI, openModal, fecharModal,
  closeConfirm, togglePwd, toast
} from './utils.js';

// ── Realtime (Firestore + sync) ───────────────────────────────
import {
  startHourlySync, syncNow, detachListeners, updateObs,
  saveCampoRecord, updateCampoRecord, deleteCampoRecord
} from './realtime.js';

// ── Navegação ─────────────────────────────────────────────────
import {
  renderTabs, activateTab, toggleMobileNav
} from './navigation.js';

// ── Aba "Campo" (lançamento) ──────────────────────────────────
import {
  populateCampoFrotas, setCampoEquipe, onFrotaChange, onCodChange,
  onTurnoChange, onHorasIn, onHaDiaIn, _verificarMeta, limparCampo,
  salvarCampo, renderPendentes, toggleSelPend, editarPend, pagPend, delPend
} from './lancamento.js';

// ── Aba "Equipe" / Registros ──────────────────────────────────
import {
  renderHerbtratosTable, exportCSV, exportTeamImage
} from './registros.js';

// ── Aba "Dashboard" ───────────────────────────────────────────
import {
  renderDash, exportDash, changeDashDate
} from './dashboard.js';

// ── Aba "Admin" (frotas, rendimentos, operações) ──────────────
import {
  renderFrotas, abrirFrota, salvarFrota, delFrota, pagFrota,
  onFrotaSrchChange, onFrotaTeamChange, onFrotaEquipeChange,
  onFrotaOpChange, onFrotaOpSrch, populateFrotaOperationsSelect,
  renderRend, abrirRend, salvarRend, delRend, onRendTurnoChange,
  populateOpEquipeSelect, onOpEquipeChange, onOpsSrchChange,
  renderOps, abrirOpAgric, onOpTurnoChange, salvarOpAgric, delOpAgric
} from './admin.js';

// ── Aba "Usuários" ────────────────────────────────────────────
import {
  renderUsuarios, pagUs, selTeams, selAbas, abrirUsuario, salvarUsuario,
  desativarUsuario, ativarUsuario
} from './usuarios.js';

// ── Modal "Configurar Colunas por Equipe" ─────────────────────
import {
  abrirTeamConfig, limparTeamConfig, renderTeamConfigCols,
  updateColLabel, moveCol, addTeamCol, removeTeamCol, updateColSetting
} from './config-colunas.js';

// ── Auth (login, logout, perfil, conta) ───────────────────────
import {
  showApp, showLogin, showSetup,
  logout, esqueciSenha, abrirGerenciar, salvarGerenciar,
  initAuthForms, initAuthObserver
} from './auth.js';

// ── Refresh global ────────────────────────────────────────────
import { refreshAll, refreshCurrentTab } from './refresh.js';

// ═══════════════════════════════════════════════════════════════
//  window.HT — namespace global usado por TODOS os onclicks
// ═══════════════════════════════════════════════════════════════
// Mantido compatível com o HTML existente para não quebrar
// nenhum onclick="window.HT && HT.foo()"
// ═══════════════════════════════════════════════════════════════
window.HT = {
  // ═════════════════════════════════════════════════════════════
  // Aba Campo — formulário e pendentes
  // ═════════════════════════════════════════════════════════════
  onCodChange, 
  onFrotaChange, 
  onTurnoChange, 
  onHorasIn, 
  onHaDiaIn,
  setCampoEquipe, 
  limparCampo, 
  salvarCampo, 
  delPend, 
  pagPend, 
  populateCampoFrotas, 
  editarPend, 
  toggleSelPend,

  // Operações agrícolas (form de Campo)
  onOpsSrchChange, 
  _verificarMeta, 
  updateObs,

  // ═════════════════════════════════════════════════════════════
  // Aba Admin — Frotas, Rendimentos, Operações
  // ═════════════════════════════════════════════════════════════
  abrirFrota, 
  salvarFrota, 
  delFrota, 
  renderFrotas, 
  pagFrota,
  onFrotaSrchChange, 
  onFrotaTeamChange, 
  onFrotaEquipeChange,
  onFrotaOpSrch, 
  onFrotaOpChange, 
  onOpEquipeChange,
  
  // Rendimentos
  renderRend,
  abrirRend,
  salvarRend,
  delRend,
  onRendTurnoChange,
  
  // Operações Agrícolas (Admin)
  renderOps, 
  abrirOpAgric, 
  salvarOpAgric, 
  delOpAgric,
  onOpTurnoChange,
  populateOpEquipeSelect,

  // ═════════════════════════════════════════════════════════════
  // Navegação / Sync
  // ═════════════════════════════════════════════════════════════
  toggleMobileNav, 
  syncNow,
  activateTab, 
  detachListeners,
  renderTabs,

  // ═════════════════════════════════════════════════════════════
  // Modal de configuração de colunas
  // ═════════════════════════════════════════════════════════════
  abrirTeamConfig, 
  renderTeamConfigCols,
  addTeamCol, 
  removeTeamCol, 
  moveCol, 
  updateColLabel, 
  updateColSetting, 
  limparTeamConfig,

  // ═════════════════════════════════════════════════════════════
  // Dashboard
  // ═════════════════════════════════════════════════════════════
  changeDashDate, 
  exportDash,

  // ═════════════════════════════════════════════════════════════
  // Usuários
  // ═════════════════════════════════════════════════════════════
  abrirUsuario, 
  salvarUsuario, 
  desativarUsuario, 
  ativarUsuario,
  renderUsuarios, 
  pagUs, 
  selTeams, 
  selAbas, 
  selAllUser: selAbas,

  // ═════════════════════════════════════════════════════════════
  // Modais / confirmação
  // ═════════════════════════════════════════════════════════════
  closeConfirm, 
  openModal, 
  fecharModal,

  // ═════════════════════════════════════════════════════════════
  // Auth / conta
  // ═════════════════════════════════════════════════════════════
  logout, 
  abrirGerenciar, 
  salvarGerenciar, 
  esqueciSenha, 
  showSetup,

  // ═════════════════════════════════════════════════════════════
  // Exports da tabela consolidada
  // ═════════════════════════════════════════════════════════════
  exportCSV, 
  exportTeamImage,

  // ═════════════════════════════════════════════════════════════
  // Toggle de senha (olho)
  // ═════════════════════════════════════════════════════════════
  togglePwd,
  
  // ═════════════════════════════════════════════════════════════
  // NOVAS FUNÇÕES (para compatibilidade com OS CAMPO)
  // ═════════════════════════════════════════════════════════════
  refreshAll,
  refreshCurrentTab,
  saveCampoRecord,
  updateCampoRecord,
  deleteCampoRecord
};

// ═══════════════════════════════════════════════════════════════
//  Listeners globais
// ═══════════════════════════════════════════════════════════════

// ── Click fora do conteúdo do modal fecha o modal ─────────────
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('modal')) {
    if (e.target.id === 'mConfirm') { 
      closeConfirm(false); 
      return; 
    }
    e.target.classList.remove('open');
  }

  // Fechar menu mobile ao clicar fora
  const nav = document.getElementById('tabsNav');
  if (nav && nav.classList.contains('mobile-open')) {
    const path = e.composedPath ? e.composedPath() : [];
    const clicouNoBotao = path.some(el => el?.id === 'mobileNavBtn');
    const clicouNoMenu = path.some(el => el?.id === 'tabsNav');

    if (!clicouNoBotao && !clicouNoMenu) {
      toggleMobileNav();
    }
  }
});

// ── PWA install prompt ────────────────────────────────────────
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  const btn = el('pwaBtn');
  if (btn) btn.style.display = 'inline-flex';
});

document.addEventListener('click', async e => {
  const btn = e.target.closest && e.target.closest('#pwaBtn');
  if (!btn) return;
  
  if (!_deferredPrompt) {
    toast('Use o menu do navegador para instalar.', 'w');
    return;
  }
  
  _deferredPrompt.prompt();
  try { 
    await _deferredPrompt.userChoice; 
  } catch (_) {}
  _deferredPrompt = null;
  btn.style.display = 'none';
});

// ── Online / Offline ──────────────────────────────────────────
window.addEventListener('online', () => {
  syncUI('ok', 'Online');
  // Tenta recarregar dados quando voltar online
  if (S.session) {
    import('./realtime.js').then(({ loadFromFirestore }) => {
      loadFromFirestore();
      toast('Conectado! Dados atualizados.', 's');
    });
  }
});

window.addEventListener('offline', () => {
  syncUI('', 'Offline — usando dados locais');
  toast('Sem conexão com a internet. Os dados são apenas locais.', 'w');
});

// Status inicial
if (!navigator.onLine) {
  syncUI('', 'Offline — usando dados locais');
}

// ── Sync agendado (a cada hora) ───────────────────────────────
startHourlySync();

// ── Inicializa formulários e observador de auth ───────────────
initAuthForms();
initAuthObserver();

// ── Service Worker (PWA) ──────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('[SW] Service Worker registrado'))
    .catch(err => console.warn('[SW] Erro ao registrar:', err));
}

// ── Previne fechamento acidental com rascunho não salvo ───────
let _hasUnsavedDraft = false;

function checkUnsavedDraft() {
  const uid = S.session?.uid;
  if (!uid) return false;
  const draft = localStorage.getItem(`ht_draft_campo_${uid}`);
  if (draft) {
    try {
      const draftData = JSON.parse(draft);
      const hasData = draftData.frota || draftData.cod || draftData.horas;
      if (hasData) {
        _hasUnsavedDraft = true;
        return true;
      }
    } catch(e) {}
  }
  _hasUnsavedDraft = false;
  return false;
}

window.addEventListener('beforeunload', (e) => {
  if (checkUnsavedDraft()) {
    e.preventDefault();
    e.returnValue = 'Você tem um rascunho não salvo. Tem certeza que deseja sair?';
    return e.returnValue;
  }
});

// ── Log de inicialização ──────────────────────────────────────
console.log('[AgroFlux] Versão 4.5.0 - Arquitetura OS CAMPO');
console.log('[AgroFlux] Firestore é a única fonte de verdade');
console.log('[AgroFlux] Sincronização em tempo real via onSnapshot');
