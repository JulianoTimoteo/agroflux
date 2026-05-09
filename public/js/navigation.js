// ═══════════════════════════════════════════════════════════════
// navigation.js — Render de tabs, ativação e navegação mobile
// ═══════════════════════════════════════════════════════════════

import { S, TEAM_ICONS } from './state.js';
import { el, norm, tc, getUniqueTeams } from './utils.js';
import { renderHerbtratosTable } from './registros.js';
import { populateCampoFrotas } from './lancamento.js';
import { renderFrotas, renderOps } from './admin.js';
import { renderUsuarios } from './usuarios.js';
import { renderDash } from './dashboard.js';
import { saveUserPrefs } from './preferences.js';

// ── Render do menu de abas (responde a permissões) ────────────
export function renderTabs() {
  const nav = el('tabsNav'); if (!nav) return;
  const s = S.session, nivel = s?.Nivel || 'operador', abasPermitidas = s?.Abas || [];
  const teams = getUniqueTeams();
  let html = '';
  if (nivel === 'master' || abasPermitidas.includes('dashboard')) {
    html += `<button class="tab-btn ${S.activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard"><i class="fas fa-chart-bar"></i><span class="lbl"> Dashboard</span></button>`;
  }
  teams.forEach(team => {
    const tabId = norm(team).replace(/\s+/g, '');
    const isActive = S.activeTab === tabId;
    if (nivel === 'master' || abasPermitidas.includes(tabId))
      html += `<button class="tab-btn ${isActive?'active':''}" data-tab="${tabId}"><i class="fas fa-${TEAM_ICONS[team] || 'tag'}"></i><span class="lbl"> ${tc(team)}</span></button>`;
  });
  [{id:'campo',i:'mobile-alt',l:'Campo'},{id:'admin',i:'cog',l:'Admin'},{id:'usuarios',i:'users',l:'Usuários'}].forEach(t => {
    if (nivel === 'master' || abasPermitidas.includes(t.id))
      html += `<button class="tab-btn ${S.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}"><i class="fas fa-${t.i}"></i><span class="lbl"> ${t.l}</span></button>`;
  });
  nav.innerHTML = html;
  nav.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => activateTab(btn.dataset.tab));
}

// ── Ativa uma aba ─────────────────────────────────────────────
// silent=true: usado no boot para restaurar a aba salva sem
// sobrescrever a preferência no Firestore com o valor de arranque.
export function activateTab(tabId, silent = false) {
  S.activeTab = tabId;
  // Persiste a aba ativa no Firestore — apenas quando o usuário muda
  // explicitamente (silent=false), nunca durante a inicialização.
  if (!silent) saveUserPrefs({ activeTab: tabId });
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  el('tabsNav')?.classList.remove('mobile-open');
  if (el('mobileNavBtn')) el('mobileNavBtn').innerHTML = '<i class="fas fa-bars"></i>';
  const teams = getUniqueTeams();
  const teamMap = {}; teams.forEach(t => teamMap[norm(t).replace(/\s+/g, '')] = t);
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  if (teamMap[tabId]) {
    S.hbEquipe = teamMap[tabId];
    // Persiste equipe da tabela consolidada (apenas clique do usuário)
    if (!silent) saveUserPrefs({ hbEquipe: S.hbEquipe });
    const pane = el('tab-equipe');
    if (pane) { pane.classList.add('active'); renderHerbtratosTable(); }
  } else {
    const pane = el(`tab-${tabId}`);
    if (pane) pane.classList.add('active');
  }
  if (tabId === 'dashboard') renderDash();
  if (tabId === 'campo') populateCampoFrotas();
  if (tabId === 'admin') { renderFrotas(); renderOps(); }
  if (tabId === 'usuarios') renderUsuarios();
}

// ── Toggle do menu mobile ─────────────────────────────────────
export function toggleMobileNav() {
  const nav = el('tabsNav'), btn = el('mobileNavBtn');
  if (nav) {
    nav.classList.toggle('mobile-open');
    if (btn) btn.innerHTML = nav.classList.contains('mobile-open') ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
  }
}
