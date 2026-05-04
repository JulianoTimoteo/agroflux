// ═══════════════════════════════════════════════════════════════
// dashboard.js — Aba Dashboard (KPIs + Charts + Export PNG)
// ═══════════════════════════════════════════════════════════════

import { S, TEAM_ICONS } from './state.js';
import {
  el, sv, tc, norm, fmt2, todayBR,
  getRendimento, getTurnoConf, getSubTurnoConf, calcHP, getOperacaoAgricola,
  getUniqueTeams, loading, toast
} from './utils.js';
import { loadFromFirestore } from './realtime.js';

// ── Render principal ──────────────────────────────────────────
export function renderDash() {
  const content = el('dashContent'); if (!content) return;
  if (S.activeTab !== 'dashboard') return;
  if (!S.dashDate) { S.dashDate = todayBR(); sv('dashDateFilter', new Date().toISOString().split('T')[0]); }
  const dashTabsContainer = el('dashTabs'); if (!dashTabsContainer) return;
  const teamsData = getUniqueTeams();
  const uniqueTeams = teamsData;
  const teamsWithData = uniqueTeams.filter(team =>
    S.equipamentos.some(eq => {
      if (norm(eq.Equipe) === norm(team)) return true;
      return (eq.operacoesPermitidas || []).some(opCod => {
        const op = getOperacaoAgricola(opCod);
        return op && norm(op.Equipe) === norm(team);
      });
    })
  );
  let finalTeams = teamsWithData;
  if (S.session?.Nivel !== 'master') {
    const abasPermitidas = S.session?.Abas || [];
    finalTeams = teamsWithData.filter(team => abasPermitidas.includes(norm(team).replace(/\s+/g, '')));
  }
  if (!S.dashEquipe || !finalTeams.includes(S.dashEquipe)) S.dashEquipe = finalTeams[0] || '';
  if (!S.dashEquipe) {
    content.innerHTML = '<div class="em-const"><i class="fas fa-exclamation-circle"></i><h3>Nenhum dado disponível.</h3></div>';
    dashTabsContainer.innerHTML = ''; return;
  }
  dashTabsContainer.innerHTML = finalTeams.map(team => `
    <button class="dtab dtab-glass ${S.dashEquipe === team ? 'active' : ''}" data-equipe="${team}">
      <i class="fas fa-${TEAM_ICONS[team] || 'tag'}"></i> ${tc(team)}
    </button>
  `).join('');
  dashTabsContainer.querySelectorAll('.dtab').forEach(btn => {
    btn.onclick = () => { S.dashEquipe = btn.dataset.equipe; renderDash(); };
  });
  const equips = S.equipamentos.filter(e => {
    if (norm(e.Equipe) === norm(S.dashEquipe)) return true;
    return (e.operacoesPermitidas || []).some(opCod => {
      const op = getOperacaoAgricola(opCod);
      return op && norm(op.Equipe) === norm(S.dashEquipe);
    });
  });
  if (!equips.length) {
    content.innerHTML = `<div class="em-const"><i class="fas fa-exclamation-circle"></i><h3>Nenhum equipamento para ${S.dashEquipe}.</h3></div>`;
    return;
  }
  let totalPlan = 0, totalReal = 0, metaOk = 0;
  const byOp = {}, byFrota = {};
  equips.forEach(eq => {
    const cod = eq.operacoesPermitidas?.[0] || '';
    const rendimentoObj = getRendimento(cod);
    const rendimentoValue = rendimentoObj ? parseFloat(rendimentoObj.Rendimento) || 0 : 0;
    const cfg = getTurnoConf(cod), sub = getSubTurnoConf(cod);
    const hp = calcHP(cod, cfg, sub), hdp = rendimentoValue * hp;
    const key = `${cod}|${eq.Modelo || ''}|${eq.Frota}`;
    const real = S.realizados[key] || {};
    const hdr = parseFloat(real.haDia) || 0;
    totalPlan += hdp; totalReal += hdr;
    if (hdp > 0 && hdr >= hdp) metaOk++;
    const opName = cod || eq.Frota;
    if (!byOp[opName]) byOp[opName] = { plan: 0, real: 0 };
    byOp[opName].plan += hdp; byOp[opName].real += hdr;
    if (!byFrota[eq.Frota]) byFrota[eq.Frota] = { plan: 0, real: 0 };
    byFrota[eq.Frota].plan += hdp; byFrota[eq.Frota].real += hdr;
  });
  const pct = totalPlan > 0 ? (totalReal / totalPlan * 100) : 0;
  const best = Object.entries(byFrota).sort((a, b) => (b[1].plan > 0 ? b[1].real / b[1].plan : 0) - (a[1].plan > 0 ? a[1].real / a[1].plan : 0)).slice(0, 3);
  const worst = Object.entries(byFrota).sort((a, b) => (a[1].plan > 0 ? a[1].real / a[1].plan : 0) - (b[1].plan > 0 ? b[1].real / b[1].plan : 0)).slice(0, 3);
  content.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:18px">
      <div class="kpi-card"><div class="kpi-icon"><i class="fas fa-tractor"></i></div><div class="kpi-val">${equips.length}</div><div class="kpi-lbl">Frotas Ativas</div></div>
      <div class="kpi-card"><div class="kpi-icon"><i class="fas fa-bullseye"></i></div><div class="kpi-val">${metaOk}</div><div class="kpi-lbl">Metas Batidas</div></div>
      <div class="kpi-card blue"><div class="kpi-icon"><i class="fas fa-chart-line"></i></div><div class="kpi-val">${fmt2(totalReal)}</div><div class="kpi-lbl">Produção Total (ha)</div></div>
      <div class="kpi-card orange"><div class="kpi-icon"><i class="fas fa-percentage"></i></div><div class="kpi-val">${pct.toFixed(1)}%</div><div class="kpi-lbl">Eficiência Global</div><div class="prog-wrap"><div class="prog-bar" style="width:${Math.min(pct, 100)}%;background:${pct >= 100 ? 'var(--perf-good)' : pct >= 70 ? 'var(--perf-medium)' : pct >= 40 ? 'var(--perf-bad)' : 'var(--perf-worst)'}"></div></div></div>
    </div>
    <div class="dash-insight"><i class="fas fa-trophy" style="color:#ffd54f"></i> <strong>Melhores:</strong> ${best.map(([k, v]) => `${k} (${v.plan > 0 ? Math.round(v.real / v.plan * 100) : 0}%)`).join(' · ') || '—'}</div>
    <div class="dash-insight warn"><i class="fas fa-exclamation-triangle"></i> <strong>Atenção:</strong> ${worst.map(([k, v]) => `${k} (${v.plan > 0 ? Math.round(v.real / v.plan * 100) : 0}%)`).join(' · ') || '—'}</div>
    <div class="dash-grid" style="margin-top:20px">
      <div class="chart-card"><div class="chart-title"><i class="fas fa-chart-bar"></i> Há/Dia por Operação</div><canvas id="chartOp"></canvas></div>
      <div class="chart-card"><div class="chart-title"><i class="fas fa-chart-pie"></i> Distribuição por Frota</div><canvas id="chartPie"></canvas></div>
    </div>`;
  requestAnimationFrame(() => { _makeBarChart('chartOp', byOp); _makePieChart('chartPie', byFrota); });
}

// ── Bar chart ─────────────────────────────────────────────────
function _makeBarChart(id, data) {
  const ctx = el(id); if (!ctx || !window.Chart) return;
  const labels = Object.keys(data);
  if (labels.length === 0) return;
  if (S.charts[id]) try { S.charts[id].destroy(); } catch {}
  const realData = labels.map(l => +data[l].real.toFixed(2));
  const planData = labels.map(l => +data[l].plan.toFixed(2));
  const realColors = labels.map((l, i) => {
    const att = planData[i] > 0 ? (realData[i] / planData[i]) * 100 : 0;
    return att >= 95 ? '#2e7d32' : att >= 66 ? '#f57c00' : att >= 33 ? '#fbc02d' : '#d32f2f';
  });
  S.charts[id] = new window.Chart(ctx, { type: 'bar', data: { labels, datasets: [
    { label: 'Planejado', data: planData, backgroundColor: '#1976d2', borderRadius: 4 },
    { label: 'Realizado', data: realData, backgroundColor: realColors, borderRadius: 4 },
  ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#000', font: { size: 10 } } } }, scales: { y: { beginAtZero: true, ticks: { color: '#000' } }, x: { grid: { display: false }, ticks: { color: '#000' } } } } });
}

// ── Pie/doughnut chart ────────────────────────────────────────
function _makePieChart(id, data) {
  const ctx = el(id); if (!ctx || !window.Chart) return;
  const entries = Object.entries(data);
  if (entries.length === 0) return;
  if (S.charts[id]) try { S.charts[id].destroy(); } catch {}
  const colors = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#6366f1'];
  S.charts[id] = new window.Chart(ctx, { type: 'doughnut', data: { labels: entries.map(e => e[0]), datasets: [{ data: entries.map(e => +e[1].real.toFixed(2)), backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '50%', plugins: { legend: { position: 'right', labels: { font: { size: 10 }, color: '#000' } } } } });
}

// ── Export do dashboard como PNG ──────────────────────────────
export async function exportDash() {
  const content = el('dashContent'); if (!content) return;
  loading(true, 'Gerando imagem...');
  const canvas = await window.html2canvas(content, { backgroundColor: '#1e293b', scale: 2 });
  const link = document.createElement('a');
  link.download = `Dashboard_${S.dashEquipe}_${S.dashDate.replace(/\//g,'-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  loading(false);
  toast('Exportado!', 's');
}

// ── Filtro por data ───────────────────────────────────────────
export async function changeDashDate(val) {
  if (!val) return;
  const brDate = val.split('-').reverse().join('/');
  S.dashDate = brDate;
  loading(true, 'Filtrando data...');
  await loadFromFirestore(brDate);
  loading(false);
}
