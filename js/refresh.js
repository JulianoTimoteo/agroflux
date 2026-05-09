// ═══════════════════════════════════════════════════════════════
// refresh.js — Coordenador central de re-render
// ═══════════════════════════════════════════════════════════════
//
// ARQUITETURA SIMPLIFICADA (estilo OS CAMPO):
//
//   refreshAll() é chamado APENAS quando:
//     1. Dados do Firestore mudam (via onSnapshot)
//     2. Usuário realiza uma ação que altera a UI (salvar, editar, etc.)
//     3. Muda de aba
//
//   NÃO causa loops porque os renderers NÃO chamam refreshAll()
//   internamente — apenas leem S (estado atualizado por listeners)
// ═══════════════════════════════════════════════════════════════

import { S } from './state.js';
import { renderTabs } from './navigation.js';
import { renderHerbtratosTable } from './registros.js';
import { populateCampoFrotas, renderPendentes } from './lancamento.js';
import { renderFrotas, renderOps, renderRend } from './admin.js';
import { renderDash } from './dashboard.js';
import { renderUsuarios } from './usuarios.js';

// ── Previne múltiplos refreshes consecutivos ──────────────────
let _refreshTimeout = null;
let _pendingRefresh = false;

// ── Função principal de refresh (debounced opcional) ─────────
export function refreshAll(immediate = false) {
  // Se for imediato, cancela qualquer debounce pendente
  if (immediate && _refreshTimeout) {
    clearTimeout(_refreshTimeout);
    _refreshTimeout = null;
    _pendingRefresh = false;
    _doRefresh();
    return;
  }
  
  // Se já tem um refresh pendente, não agenda outro
  if (_pendingRefresh) return;
  
  _pendingRefresh = true;
  
  // Pequeno debounce para evitar múltiplos refreshes em sequência
  if (_refreshTimeout) clearTimeout(_refreshTimeout);
  _refreshTimeout = setTimeout(() => {
    _refreshTimeout = null;
    _pendingRefresh = false;
    _doRefresh();
  }, 50);
}

// ── Executa o refresh propriamente dito ───────────────────────
function _doRefresh() {
  // 1. Navegação (abas)
  renderTabs();
  
  // 2. Aba Registros (HerbTratos)
  //    Só renderiza se não estiver na dashboard (para evitar conflito)
  if (S.activeTab !== 'dashboard') {
    renderHerbtratosTable();
  }
  
  // 3. Aba Campo — frotas e pendentes
  populateCampoFrotas();
  renderPendentes();
  
  // 4. Aba Admin — frotas, operações e rendimentos
  renderFrotas();
  renderOps();
  renderRend();
  
  // 5. Aba Dashboard
  if (S.activeTab === 'dashboard') {
    renderDash();
  }
  
  // 6. Aba Usuários (se visível e usuário tem permissão)
  const isPrivileged = ['master', 'administrador', 'admin'].includes(S.session?.Nivel?.toLowerCase() || '');
  if (S.activeTab === 'usuarios' && isPrivileged) {
    renderUsuarios();
  }
  
  // 7. Atualiza contadores/timers na UI
  _updateUICounters();
}

// ── Atualiza elementos auxiliares da UI ───────────────────────
function _updateUICounters() {
  // Atualiza contador de pendentes no badge (se existir)
  const pendCount = S.pendentes?.length || 0;
  const pendBadge = document.getElementById('pendCountBadge');
  if (pendBadge) {
    if (pendCount > 0) {
      pendBadge.textContent = pendCount;
      pendBadge.style.display = 'inline-block';
    } else {
      pendBadge.style.display = 'none';
    }
  }
  
  // Atualiza status de conexão (já feito pelo realtime.js)
  // Mantido apenas para compatibilidade
}

// ── Refresh específico para a aba atual (mais leve) ───────────
export function refreshCurrentTab() {
  switch (S.activeTab) {
    case 'campo':
      populateCampoFrotas();
      renderPendentes();
      break;
    case 'registros':
      renderHerbtratosTable();
      break;
    case 'dashboard':
      renderDash();
      break;
    case 'admin':
      renderFrotas();
      renderOps();
      renderRend();
      break;
    case 'usuarios':
      if (['master', 'administrador', 'admin'].includes(S.session?.Nivel?.toLowerCase() || '')) {
        renderUsuarios();
      }
      break;
    default:
      refreshAll();
  }
}

// ── Força atualização completa (ignora debounce) ──────────────
export function forceRefresh() {
  _doRefresh();
}

// ── Exporta também as funções de render individuais para casos específicos
export {
  renderTabs,
  renderHerbtratosTable,
  populateCampoFrotas,
  renderPendentes,
  renderFrotas,
  renderOps,
  renderDash,
  renderUsuarios
};
