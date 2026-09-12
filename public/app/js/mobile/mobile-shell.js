// ═══════════════════════════════════════════════════════════════
// mobile/mobile-shell.js — Interface de celular (APK e navegador)
// ═══════════════════════════════════════════════════════════════
// Navegação inferior, cartões no lugar de tabelas e atalhos de
// toque. Mesmo núcleo (core/) e mesmo Firebase da versão desktop.
// ═══════════════════════════════════════════════════════════════

import { el, tc, fmt2, escHtml } from '../utils.js';
import { S } from '../state.js';
import { podeAcessar } from '../core/permissions.js';
import { isMobileUi, onUiModeChange } from '../platform/platform.js';
import { notificationService } from '../platform/native/index.js';
import { CONN, connState, onConnChange } from '../services/connection.js';

// ── Navegação inferior ────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'campo',     icon: 'clipboard-check', label: 'Campo' },
  { id: 'pendentes', icon: 'clock',           label: 'Pendentes' },
  { id: 'dashboard', icon: 'chart-simple',    label: 'Painel' },
  { id: 'menu',      icon: 'bars',            label: 'Menu' },
];

export function renderMobileNav() {
  const nav = el('mobileNav');
  if (!nav) return;
  const visible = NAV_ITEMS.filter(i =>
    i.id === 'menu' || i.id === 'pendentes' || podeAcessar(i.id));
  nav.innerHTML = visible.map(i => `
    <button class="mnav-btn${S.activeTab === i.id ? ' active' : ''}" data-mnav="${i.id}" aria-label="${i.label}">
      <i class="fas fa-${i.icon}"></i><span>${i.label}</span>
      ${i.id === 'pendentes' ? '<em class="mnav-badge" id="mnavPendBadge" hidden>0</em>' : ''}
    </button>`).join('');
  nav.querySelectorAll('[data-mnav]').forEach(btn => {
    btn.onclick = () => _goto(btn.dataset.mnav);
  });
  updatePendBadge();
}

function _goto(id) {
  if (id === 'menu') { window.HT?.toggleMobileNav?.(); return; }
  if (id === 'pendentes') {
    window.HT?.activateTab?.('campo');
    setTimeout(() => el('pendCards')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  } else {
    window.HT?.activateTab?.(id);
  }
  document.querySelectorAll('[data-mnav]').forEach(b => b.classList.toggle('active', b.dataset.mnav === id));
}

export function updatePendBadge() {
  const badge = el('mnavPendBadge');
  if (!badge) return;
  const n = Number(el('pendCnt')?.textContent || 0);
  badge.textContent = n;
  badge.hidden = n <= 0;
}

// ── Cartões de registros pendentes (substituem a tabela) ──────
export function renderPendentesCards(rows, extraCols = []) {
  const box = el('pendCards');
  if (!box) return;
  if (!rows.length) {
    box.innerHTML = `<div class="pcard-empty"><i class="fas fa-check-circle"></i> Nenhum registro pendente</div>`;
    updatePendBadge();
    return;
  }
  box.innerHTML = rows.map(r => `
    <article class="pcard">
      <header class="pcard-head">
        <span class="pcard-cod">#${escHtml(String(r.codOperacao))}</span>
        <span class="badge bdg-pendente">Pendente</span>
      </header>
      <h4 class="pcard-title">${escHtml(tc(r.descricao))}</h4>
      <dl class="pcard-grid">
        <div><dt>Data</dt><dd>${escHtml(r.data || '')}</dd></div>
        <div><dt>Frota</dt><dd>${escHtml(String(r.frota))}</dd></div>
        <div><dt>Horas</dt><dd>${fmt2(r.horasReal)}</dd></div>
        <div><dt>Há/Dia</dt><dd>${fmt2(r.haDia)}</dd></div>
        ${extraCols.map(c => `<div><dt>${escHtml(c.label)}</dt><dd>${fmt2(r.extras?.[c.id] || 0)}</dd></div>`).join('')}
      </dl>
      ${r.geo ? `<p class="pcard-meta"><i class="fas fa-location-dot"></i> ${r.geo.lat.toFixed(5)}, ${r.geo.lng.toFixed(5)}</p>` : ''}
      ${r.foto ? `<img class="pcard-foto" src="${r.foto}" alt="Foto do apontamento ${escHtml(String(r.codOperacao))}">` : ''}
      <footer class="pcard-acts">
        <button class="btn btn-outline btn-sm" onclick="window.HT && HT.editarPend('${r.id}')"><i class="fas fa-pen"></i> Editar</button>
        <button class="btn btn-danger btn-sm" onclick="window.HT && HT.delPend('${r.id}')"><i class="fas fa-trash"></i> Excluir</button>
        <button class="btn btn-success btn-sm" onclick="window.HT && HT.sincronizarCampo()"><i class="fas fa-cloud-arrow-up"></i> Enviar</button>
      </footer>
    </article>`).join('');
  updatePendBadge();
}

// ── Aviso de sincronização (notificação do aparelho) ──────────
let _lastNotified = null;
function _watchConnection() {
  onConnChange(async state => {
    const label = el('syncLabel');
    if (label) label.dataset.state = state;
    if (state === _lastNotified) return;
    _lastNotified = state;
    if (!isMobileUi()) return;
    if (state === CONN.OFFLINE) {
      notificationService.notify('AgroFlux offline', 'Os apontamentos ficam salvos no aparelho e sobem quando a internet voltar.');
    } else if (state === CONN.ONLINE) {
      const pend = S.pendentes?.length || 0;
      if (pend > 0) notificationService.notify('Conexão restabelecida', `${pend} apontamento(s) prontos para enviar.`);
    }
  });
}

export function initMobileShell() {
  renderMobileNav();
  _watchConnection();
  onUiModeChange(() => renderMobileNav());
  if (isMobileUi()) notificationService.requestPermission();
  if (connState() === CONN.OFFLINE) _lastNotified = CONN.OFFLINE;
}
