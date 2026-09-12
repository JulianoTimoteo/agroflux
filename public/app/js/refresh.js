// ═══════════════════════════════════════════════════════════════
// refresh.js — Coordenador central de re-render
// ═══════════════════════════════════════════════════════════════
// Centraliza refreshAll() em UM ÚNICO MÓDULO importado por todos
// os outros. Isso evita ciclos de import: módulos como admin.js
// e usuarios.js só dependem de refresh.js (que importa todos os
// renderers), não dependem uns dos outros.
//
// IMPORTANTE: imports são late-bound em ES modules, portanto os
// renderers podem chamar refreshAll() de volta sem deadlock.
// ═══════════════════════════════════════════════════════════════

import { S } from './state.js';
import { renderTabs } from './navigation.js';
import { renderHerbtratosTable } from './registros.js';
import { populateCampoFrotas, renderPendentes } from './lancamento.js';
import { renderFrotas, renderOps } from './admin.js';
import { renderDash } from './dashboard.js';

export function refreshAll() {
  renderTabs();
  if (S.activeTab !== 'dashboard') renderHerbtratosTable();
  populateCampoFrotas();
  renderPendentes();
  renderFrotas();
  renderOps();
  if (S.activeTab === 'dashboard') renderDash();
}
