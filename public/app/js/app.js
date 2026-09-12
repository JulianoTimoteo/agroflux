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
  desativarUsuario, ativarUsuario, excluirUsuario
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

// ── Skills / Auditoria ────────────────────────────────────────
import { runWebdesignReview, runAuditSkill } from './webdesign-review.functions.js';

// ── Refresh global ────────────────────────────────────────────
import { refreshAll } from './refresh.js';

// ── Plataforma (web desktop × aplicativo Android) ─────────────
import { initPlatform, isMobileUi, setUiMode, getForcedUiMode, currentUiMode } from './platform/platform.js';
import { initConnection } from './services/connection.js';
import { initMobileShell, renderMobileNav } from './mobile/mobile-shell.js';
import { initWebShell } from './web/web-shell.js';
import {
  tirarFotoCampo, capturarLocalCampo, removerFotoCampo, removerLocalCampo
} from './mobile/campo-anexos.js';

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
  abrirUsuario, salvarUsuario, desativarUsuario, ativarUsuario, excluirUsuario,
  renderUsuarios, pagUs, selTeams, selAbas, selAllUser: selAbas,

  // Modais / confirmação
  closeConfirm, openModal, fecharModal,

  // Auth / conta
  logout, abrirGerenciar, salvarGerenciar, esqueciSenha, showSetup,

  // Exports da tabela consolidada
  exportCSV, exportTeamImage,

  // Toggle de senha (olho)
  togglePwd,

  // Webdesign Review
  runWebdesignReview,
  runAuditSkill,
  
  // Anexos do apontamento (câmera / GPS) — web e APK
  tirarFotoCampo, capturarLocalCampo, removerFotoCampo, removerLocalCampo,

  // Alternar entre interface de computador e de celular
  alternarInterface: () => {
    const novo = currentUiMode() === 'mobile' ? 'web' : 'mobile';
    setUiMode(novo);
    renderMobileNav();
    _atualizarBotaoInterface();
    toast(novo === 'mobile' ? 'Interface de celular ativada.' : 'Interface de computador ativada.', 's');
  },

  // Login (adicionado para garantir disponibilidade total)
  login: (login, pwd) => import('./auth.js').then(m => m.loginComUsuario(login, pwd))
};

function _atualizarBotaoInterface() {
  const btn = el('uiModeBtn');
  if (!btn) return;
  const mobile = isMobileUi();
  btn.innerHTML = `<i class="fas fa-${mobile ? 'desktop' : 'mobile-screen-button'}"></i>`;
  btn.title = mobile ? 'Ver versão de computador' : 'Ver versão de celular';
  btn.setAttribute('aria-label', btn.title);
}

// Garante nome acessível aos controles estáticos e aos criados dinamicamente.
function ensureAccessibleControls(root = document) {
  root.querySelectorAll?.('input, select, textarea').forEach(control => {
    if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return;
    if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return;
    if (control.closest('label')) return;
    const nearbyLabel = control.closest('.fg')?.querySelector('label');
    const name = nearbyLabel?.textContent?.replace(/\s+/g, ' ').trim() || control.placeholder || control.title;
    if (name) control.setAttribute('aria-label', name);
  });

  root.querySelectorAll?.('button').forEach(button => {
    if (button.getAttribute('aria-label') || button.getAttribute('aria-labelledby')) return;
    const visibleText = button.textContent?.replace(/\s+/g, ' ').trim();
    if (visibleText) return;
    const icon = button.querySelector('i')?.className || '';
    const iconNames = [
      ['fa-edit', 'Editar'], ['fa-pen', 'Editar'], ['fa-trash', 'Excluir'],
      ['fa-arrow-up', 'Mover para cima'], ['fa-arrow-down', 'Mover para baixo'],
      ['fa-fire', 'Sincronizar'], ['fa-times', 'Fechar'], ['fa-save', 'Salvar']
    ];
    const inferred = iconNames.find(([className]) => icon.includes(className))?.[1];
    button.setAttribute('aria-label', button.title || inferred || 'Ação');
  });
}

ensureAccessibleControls();
new MutationObserver(records => {
  records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) ensureAccessibleControls(node);
  }));
}).observe(document.body, { childList: true, subtree: true });

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
    const clicouNoMenu  = path.some(el => el.id === 'tabsNav' || el.id === 'sideNav' || el.id === 'sideNavOverlay');

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

// ── Plataforma + conexão (ONLINE / OFFLINE / CONECTANDO / ...) ─
initPlatform();
initConnection();
initMobileShell();
initWebShell();
_atualizarBotaoInterface();

// Mantém a navegação inferior em sincronia com a aba ativa
document.addEventListener('click', () => setTimeout(renderMobileNav, 60));

// ── Sync agendado ─────────────────────────────────────────────
startHourlySync();

// ── Inicializa formulários e observador de auth ───────────────
initAuthForms();
initAuthObserver();

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // Detecta se há uma nova versão do app disponível (CSS/JS novo)
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Notifica o usuário para atualizar e ver os cantos arredondados/dados novos
          if (confirm('Nova versão disponível! Deseja atualizar para aplicar melhorias de layout e sincronização?')) {
            window.location.reload();
          }
        }
      });
    });
  }).catch(err => console.warn('[SW] Falha ao registrar:', err));
}

console.log('[AgroFlux] v4.9.0 · Sincronismo Realtime Estilo OS-CAMPO · CSS Fix');