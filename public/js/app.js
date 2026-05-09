// ═══════════════════════════════════════════════════════════════
// app.js — Entry point (boot do PWA HerbTratos)
// ═══════════════════════════════════════════════════════════════
// Responsável por:
//   1. Importar todos os módulos.
//   2. Expor `window.HT` com TODAS as funções referenciadas via
//      onclick="window.HT && HT.foo()" no HTML — fidelidade 1:1
//      com o monolito original.
//   3. Inicializar listeners globais (PWA, online/offline, modais,
//      observador de auth e formulários).
//   4. Registrar o Service Worker.
// ═══════════════════════════════════════════════════════════════

// ── Tipos de dado / estado ────────────────────────────────────
import { S } from './state.js';

// ── Utils (UI helpers, formatadores, modais) ──────────────────
import {
  el, gv, sv, txt, syncUI, openModal, fecharModal,
  closeConfirm, togglePwd, toast
} from './utils.js';

// ── Realtime (Firestore + sync) ───────────────────────────────
import {
  startHourlySync, syncNow, detachListeners, updateObs
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

// ── Realtime: sincronizarCampo (precisa estar exposto) ────────
import { sincronizarCampo } from './realtime.js';

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
import { refreshAll } from './refresh.js';

// ═══════════════════════════════════════════════════════════════
//  window.HT — namespace global usado por TODOS os onclicks
// ═══════════════════════════════════════════════════════════════
// Mantido idêntico ao monolito original (linhas 2441–2462) para
// preservar a integração com o HTML existente sem quaisquer
// alterações estruturais.
// ═══════════════════════════════════════════════════════════════
window.HT = {
  // Aba Campo — formulário e pendentes
  onCodChange, onFrotaChange, onTurnoChange, onHorasIn, onHaDiaIn,
  setCampoEquipe, limparCampo, salvarCampo, sincronizarCampo,
  delPend, pagPend, populateCampoFrotas, editarPend, toggleSelPend,

  // Operações agrícolas (form de Campo)
  onOpsSrchChange, _verificarMeta, updateObs,

  // Aba Admin — Frotas
  abrirFrota, salvarFrota, delFrota, renderFrotas, pagFrota,
  onFrotaSrchChange, onFrotaTeamChange, onFrotaEquipeChange,
  onFrotaOpSrch, onFrotaOpChange, onOpEquipeChange,

  // Navegação / sync
  toggleMobileNav, syncNow,

  // Modal de configuração de colunas
  abrirTeamConfig, renderTeamConfigCols, onOpTurnoChange,
  addTeamCol, removeTeamCol, moveCol, updateColLabel, updateColSetting, limparTeamConfig,

  // Tabs e listeners
  activateTab, detachListeners,

  // Operações agrícolas (Admin)
  renderOps, abrirOpAgric, salvarOpAgric, delOpAgric,

  // Tabs (rendering)
  renderTabs,

  // Dashboard
  changeDashDate, exportDash,

  // Usuários
  abrirUsuario, salvarUsuario, desativarUsuario, ativarUsuario,
  renderUsuarios, pagUs, selTeams, selAbas, selAllUser: selAbas,

  // Modais / confirmação
  closeConfirm, openModal, fecharModal,

  // Auth / conta
  logout, abrirGerenciar, salvarGerenciar, esqueciSenha, showSetup,

  // Exports da tabela consolidada
  exportCSV, exportTeamImage,

  // Toggle de senha (olho)
  togglePwd
};

// ═══════════════════════════════════════════════════════════════
//  Listeners globais
// ═══════════════════════════════════════════════════════════════

// ── Click fora do conteúdo do modal fecha o modal ─────────────
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('modal')) {
    if (e.target.id === 'mConfirm') { closeConfirm(false); return; }
    e.target.classList.remove('open');
  }

  // Fechar menu mobile ao clicar fora
  const nav = document.getElementById('tabsNav');
  if (nav && nav.classList.contains('mobile-open')) {
    // Usamos o caminho completo do clique para detectar o botão ou o menu.
    // Isso evita que o menu feche sozinho quando o ícone interno do botão é trocado/removido.
    const path = e.composedPath ? e.composedPath() : [];
    const clicouNoBotao = path.some(el => el.id === 'mobileNavBtn');
    const clicouNoMenu  = path.some(el => el.id === 'tabsNav');

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
  try { await _deferredPrompt.userChoice; } catch (_) {}
  _deferredPrompt = null;
  btn.style.display = 'none';
});

// ── Online / Offline ──────────────────────────────────────────
window.addEventListener('online',  () => syncUI('ok',   'Online'));
window.addEventListener('offline', () => syncUI('',     'Offline'));
if (!navigator.onLine) syncUI('', 'Offline');

// ── Sync agendado ─────────────────────────────────────────────
startHourlySync();

// ── Inicializa formulários e observador de auth ───────────────
initAuthForms();
initAuthObserver();

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

console.log('[AgroFlux] Publicado Git - v4.6.0 · Fluxo cross-device ativo');
