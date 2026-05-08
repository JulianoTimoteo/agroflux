// ═══════════════════════════════════════════════════════════════
// utils.js — Helpers genéricos (DOM, formatação, lookups, UI)
// ═══════════════════════════════════════════════════════════════

import { S, TEAM_ICONS } from './state.js';

// ── DOM helpers ───────────────────────────────────────────────
export const gv  = id => document.getElementById(id)?.value || '';
export const sv  = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
export const txt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
export const el  = id => document.getElementById(id);

// ── Formatadores ──────────────────────────────────────────────
export const tc = s => String(s || '').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
export const todayBR = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
export const fmt2 = n => (parseFloat(n) || 0).toFixed(2);
export const escHtml = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const getBdgClass = (t) => "bdg-" + norm(t).replace(/\s+/g, '-');

// ── Lookups de operações agrícolas ────────────────────────────
export function getRendimento(cod) {
  return S.operacoesAgricolas.find(x => String(x.CodOperacao) === String(cod));
}
export function getRendimentoVal(cod) {
  const r = S.operacoesAgricolas.find(x => String(x.CodOperacao) === String(cod));
  return r ? parseFloat(r.Total || r.Rendimento) || 0 : 0;
}
export function getHoraBase(cod) {
  const p = S.operacoesAgricolas.find(x => String(x.CodOperacao) === String(cod));
  return p ? parseFloat(p.HorasBase) || 3.95 : 3.95;
}
export function getTurnoConf(cod) {
  const r = S.operacoesAgricolas.find(x => String(x.CodOperacao) === String(cod));
  return r ? String(r.Turno || '1') : '1';
}
export function getSubTurnoConf(cod) {
  const r = S.operacoesAgricolas.find(x => String(x.CodOperacao) === String(cod));
  return r ? String(r.SubTurno || '') : '';
}
export function calcHP(cod, turno, subTurno) {
  const base = getHoraBase(cod);
  const map = { '1': base, '2': base * 2, '3': base * 3, '4': (base / 8) * 10, '5': (base / 8) * 12 };
  let val = (map[turno] ?? base);
  if (subTurno === '2') val = val * 2;
  return val;
}
export function getOperacaoAgricola(cod) {
  return S.operacoesAgricolas.find(o => String(o.CodOperacao || o.cod) === String(cod));
}
export function getTurnoDisplay(turno, subTurno) {
  const m = { '1':'1 (8h)', '2':'2 (16h)', '3':'3 (24h)', '4':'4 (10h)', '5':'5 (12h)' };
  let t = m[turno] || turno;
  return (subTurno === '2') ? t + ' - 2 turnos' : t;
}
export function getSelectionStyle(team, isActive = false) {
  if (!team) return '';
  if (!isActive) return 'style="background: #fff !important; color: var(--muted) !important; border: 1.5px solid var(--border) !important;"';
  return 'style="background: #fff !important; color: #1b5e20 !important; border: 2.5px solid #1b5e20 !important; font-weight: 700; transform: scale(1.02); box-shadow: var(--sh);"';
}
export function getCollectionForOperation(codOperacao) {
  const op = getOperacaoAgricola(codOperacao);
  if (!op) return 'tratos';
  return norm(op.Equipe || 'Tratos').replace(/\s+/g, '');
}

// ── Lista de equipes únicas (defaults + dinâmicas) ────────────
export function getUniqueTeams() {
  const defaultTeams = ['Tratos', 'Herbicida', 'Fertirrigação', 'Preparo', 'Linha Amarela', 'Biomassa'];
  const all = [...defaultTeams, ...S.operacoesAgricolas.map(o => o.Equipe)].filter(Boolean);
  const map = new Map();
  all.forEach(t => {
    const key = norm(t);
    if (!map.has(key)) map.set(key, t);
  });
  return Array.from(map.values()).sort();
}

// ── UI feedback ───────────────────────────────────────────────
export function syncUI(state, label) {
  const d = el('syncDot'), l = el('syncLabel');
  if (d) d.className = 'sync-dot' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : state === 'warn' ? ' warn' : '');
  if (l) l.textContent = label;
}

export function playSuccessSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.3);
  } catch(e) { console.warn("Audio Context error", e); }
}

export function loading(show, msg = 'Carregando...') {
  const ov = el('loadingOverlay');
  if (!ov) return;
  ov.style.display = show ? 'flex' : 'none';
  txt('loadingMsg', msg);
}

export function toast(msg, type = 's') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas fa-${type==='s'?'check-circle':type==='e'?'times-circle':'exclamation-circle'}"></i>${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3800);
}

// ── Modais ────────────────────────────────────────────────────
export function openModal(id) { el(id)?.classList.add('open'); }
export function fecharModal(id) { el(id)?.classList.remove('open'); }

export function customConfirm(title, msg, okLabel = 'Confirmar', cancelLabel = 'Cancelar') {
  txt('mConfirmTitle', title);
  txt('mConfirmMsg', msg);
  const okBtn = el('mConfirm')?.querySelector('.btn-primary');
  const cancelBtn = el('mConfirm')?.querySelector('.btn-secondary');
  if (okBtn) okBtn.textContent = okLabel;
  if (cancelBtn) cancelBtn.textContent = cancelLabel;
  openModal('mConfirm');
  return new Promise(resolve => { S.confirmRes = resolve; });
}

export function closeConfirm(res) {
  fecharModal('mConfirm');
  if (S.confirmRes) {
    const resolve = S.confirmRes;
    S.confirmRes = null;
    resolve(res);
  }
}

// ── Paginação ─────────────────────────────────────────────────
export function renderPag(elId, total, pp, page, prevFn, nextFn) {
  const container = el(elId); if (!container) return;
  const pages = Math.ceil(total / pp);
  container.innerHTML = pages > 1 ?
    `<button class="btn-page" onclick="${prevFn}" ${page<=1?'disabled':''}>‹</button>
     <span>${page}/${pages}</span>
     <button class="btn-page" onclick="${nextFn}" ${page>=pages?'disabled':''}>›</button>` : '';
}

// ── Toggle visibilidade de senha ──────────────────────────────
export function togglePwd(id, icon) {
  const inp = el(id); if (!inp) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  if (icon) {
    icon.classList.toggle('fa-eye', !isPass);
    icon.classList.toggle('fa-eye-slash', isPass);
  }
}

// Reexport para conveniência
export { TEAM_ICONS };
