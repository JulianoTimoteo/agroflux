// ═══════════════════════════════════════════════════════════════
// registros.js — Tabela HerbTratos consolidada (planejado×realizado)
//                e exports (CSV, imagem da equipe)
// ═══════════════════════════════════════════════════════════════
// Esta é a "aba da equipe" que mostra para cada equipamento:
//   - O planejado (calculado a partir das operacoesAgricolas)
//   - O realizado (vindo dos snapshots Firestore por equipe)
//   - Motivo / Ação Corretiva / Observação COA (editável p/ admin)
// ═══════════════════════════════════════════════════════════════

import { S } from './state.js';
import {
  el, tc, norm, fmt2, escHtml, todayBR,
  getOperacaoAgricola, getRendimento, calcHP,
  getTurnoConf, getSubTurnoConf, getTurnoDisplay, TEAM_ICONS
} from './utils.js';
import { loading, toast } from './utils.js';

// ── Render principal da tabela HerbTratos ─────────────────────
export function renderHerbtratosTable() {
  const tbody = el('hbBody'), thead = el('hbHead');
  if (!tbody || !thead || !S.equipamentos.length) return;

  const config = S.teamConfigs[S.hbEquipe] || [
    { id: 'hah', label: 'Há/h', type: 'system' },
    { id: 'htr', label: 'Horas Trab.', type: 'system' },
    { id: 'had', label: 'Há/Dia', type: 'system' }
  ];
  const planCols = config.filter(c => c.showPlan !== false);
  const realCols = config.filter(c => c.showReal !== false);

  thead.innerHTML = `
    <tr>
      <th rowspan="2" class="th-base">Cód.</th><th rowspan="2" class="th-base">Operação</th><th rowspan="2" class="th-base">Frota</th><th rowspan="2" class="th-base">Modelo</th><th rowspan="2" class="th-base">Turno</th>
      <th colspan="${planCols.length}" class="th-plan">PLANEJADO</th>
      <th colspan="${realCols.length + 3}" class="th-real">REALIZADO</th>
    </tr>
    <tr>
      ${planCols.map(c => `<th class="th-plan">${c.label}</th>`).join('')}
      ${realCols.map(c => `<th class="th-real">${c.label}</th>`).join('')}
      <th class="th-real">Motivo</th><th class="th-real">Ação Corretiva</th><th class="th-real">Observação COA</th>
    </tr>`;

  const title = el('hbEquipeTitle'), header = el('hbTabHeader');
  if (title) title.textContent = `Equipe ${S.hbEquipe}`;
  if (header) { const icon = header.querySelector('i'); if (icon) icon.className = `fas fa-${TEAM_ICONS[S.hbEquipe] || 'tractor'}`; }

  let equips = S.equipamentos.filter(eq => {
    if (norm(eq.Equipe) === norm(S.hbEquipe)) return true;
    return (eq.operacoesPermitidas || []).some(opCod => {
      const op = getOperacaoAgricola(opCod);
      return op && norm(op.Equipe || op.equipe) === norm(S.hbEquipe);
    });
  });

  // Ordenar: equipamentos com dados realizados aparecem no topo
  equips.sort((a, b) => {
    const hasData = (eq) => {
      return (eq.operacoesPermitidas || []).some(opCod => {
        const op = getOperacaoAgricola(opCod);
        if (!op || norm(op.Equipe) !== norm(S.hbEquipe)) return false;
        const k = `${String(opCod).trim()}|${(eq.Modelo || '').trim()}|${String(eq.Frota).trim()}`;
        const r = S.realizados[k];
        return r && (r.horas > 0 || r.haDia > 0);
      });
    };
    return (hasData(b) ? 1 : 0) - (hasData(a) ? 1 : 0);
  });

  if (!equips.length) {
    tbody.innerHTML = `<tr><td colspan="${5 + planCols.length + realCols.length + 3}" class="empty-row">Nenhum equipamento em ${S.hbEquipe}.</td></tr>`;
    return;
  }

  tbody.innerHTML = equips.map(eq => {
    const teamOps = (eq.operacoesPermitidas || []).filter(opCod => {
      const op = getOperacaoAgricola(opCod);
      return op && norm(op.Equipe) === norm(S.hbEquipe);
    });

    // AUTO-CORREÇÃO: prefere a operação que tem realizado no banco; senão, a primeira
    const activeOpCod = teamOps.find(opCod => {
      const k = `${String(opCod).trim()}|${(eq.Modelo || '').trim()}|${String(eq.Frota).trim()}`;
      const r = S.realizados[k];
      return r && (r.horas > 0 || r.haDia > 0);
    }) || teamOps[0] || '';

    const cod = activeOpCod, cfg = getTurnoConf(cod), sub = getSubTurnoConf(cod);
    const op = getOperacaoAgricola(cod);
    const rendimentoObj = getRendimento(cod);
    const rendimentoValue = parseFloat(rendimentoObj?.Rendimento || rendimentoObj?.Total || 0);
    const hp = calcHP(cod, cfg, sub), hdp = rendimentoValue * hp;
    const key = `${String(cod).trim()}|${(eq.Modelo || '').trim()}|${String(eq.Frota).trim()}`;
    const real = S.realizados[key] || {};
    const hReal = parseFloat(real.horas) || 0;
    const haReal = parseFloat(real.haDia) || 0;

    // Lógica de Meta Dinâmica (Hectares ou Volume)
    let ok = hdp > 0 && haReal >= hdp;

    config.forEach(c => {
      if (c.label.toLowerCase().includes('m³')) {
        const metaV = parseFloat(rendimentoObj?.extrasPlan?.[c.id]) || 0;
        const realV = parseFloat(real.extras?.[c.id]) || 0;
        if (metaV > 0 && realV < metaV) ok = false;
      }
    });

    const renderCell = (c, isPlan) => {
      if (isPlan) {
        if (c.id === 'hah' || c.id === 'rendimento' || c.id === 'total') return fmt2(rendimentoValue);
        if (c.id === 'htr') return fmt2(hp);
        if (c.id === 'had') return fmt2(hdp);
        return fmt2(rendimentoObj?.extrasPlan?.[c.id] || 0);
      } else {
        if (c.id === 'hah' || c.id === 'rendimento' || c.id === 'total') return fmt2(hReal > 0 ? haReal / hReal : 0);
        if (c.id === 'htr') return fmt2(real.horas || 0);
        if (c.id === 'had') return fmt2(real.haDia || 0);

        const val = parseFloat(real.extras?.[c.id]) || 0;
        const label = c.label || '';
        let unit = label.includes('m³') ? 'm³' : (label.split(' ')[0] || 'Un');

        let details = '';
        if (hReal > 0) {
          details += `<div style="font-size:0.55rem; color:var(--b800); font-weight:bold;">${fmt2(val/hReal)} ${unit}/h</div>`;
        }
        if (haReal > 0) {
          details += `<div style="font-size:0.55rem; color:var(--g700); font-weight:bold;">${fmt2(val/haReal)} ${unit}/ha</div>`;
        }
        return `<div>${fmt2(val)}</div>${details}`;
      }
    };

    return `<tr class="${ok ? 'row-meta-ok' : haReal > 0 ? 'row-meta-no' : ''}">
      <td class="mono">${cod}</td><td class="td-l">${op ? tc(op.Descricao) : ''}</td><td>${eq.Frota || ''}</td><td class="td-l">${tc(eq.Modelo || '')}</td><td>${getTurnoDisplay(cfg, sub)}</td>
      ${planCols.map(c => `<td class="td-plan ${['hah','htr','had'].includes(c.id) ? '' : 'bold'}">${renderCell(c, true)}</td>`).join('')}
      ${realCols.map(c => {
        let cls = 'td-real';
        if (c.id === 'hah') cls += (ok ? ' val-ok' : haReal > 0 ? ' val-no' : '');
        let content = renderCell(c, false);
        if (c.id === 'hah' && ok) content += ' <span class="meta-selo"><i class="fas fa-star"></i> Meta</span>';
        return `<td class="${cls}">${content}</td>`;
      }).join('')}
      <td class="td-real real-cell-wrap">${escHtml(real.motivo || '')}</td>
      <td class="td-real real-cell-wrap">${escHtml(real.acaoCorretiva || '')}</td>
      <td class="td-real">${(S.session?.Nivel === 'admin' || S.session?.Nivel === 'master') && real.id ?
        `<textarea style="font-size:.65rem; width:100%; min-width:130px; border:1.5px solid var(--border); border-radius:4px; padding:4px;" onblur="window.HT.updateObs('${real.col}', '${real.id}', this.value)">${escHtml(real.obs || '')}</textarea>` :
        `<span class="real-cell-wrap">${escHtml(real.obs || '')}</span>`}</td>
    </tr>`;
  }).join('');
}

// ── Export CSV ────────────────────────────────────────────────
export function exportCSV() {
  const config = S.teamConfigs[S.hbEquipe] || [
    { id: 'hah', label: 'Há/h', type: 'system' },
    { id: 'htr', label: 'Horas Trab.', type: 'system' },
    { id: 'had', label: 'Há/Dia', type: 'system' }
  ];
  const planCols = config.filter(c => c.showPlan !== false);
  const realCols = config.filter(c => c.showReal !== false);
  const hdrs = ['Cód. Operação', 'Operação', 'Frota', 'Modelo', 'Equipe', 'Turno'];
  planCols.forEach(c => hdrs.push(`${c.label} (Plan)`));
  realCols.forEach(c => hdrs.push(`${c.label} (Real)`));
  hdrs.push('Motivo', 'Ação Corretiva', 'Observação');
  const equips = S.equipamentos.filter(e => norm(e.Equipe) === norm(S.hbEquipe));
  const rows = equips.map(eq => {
    const cod = eq.operacoesPermitidas?.[0];
    const rendimentoObj = getRendimento(cod);
    const rendimentoValue = parseFloat(rendimentoObj?.Rendimento || 0);
    const cfg = getTurnoConf(cod), sub = getSubTurnoConf(cod);
    const hp = calcHP(cod, cfg, sub), hdp = rendimentoValue * hp;
    const op = getOperacaoAgricola(cod);
    const key = `${cod}|${eq.Modelo||''}|${eq.Frota}`;
    const real = S.realizados[key] || {};
    const data = [cod, op ? op.Descricao : '', eq.Frota, eq.Modelo, eq.Equipe || S.hbEquipe, getTurnoDisplay(cfg, sub)];
    planCols.forEach(c => {
      if (c.id === 'hah' || c.id === 'rendimento') data.push(fmt2(rendimentoValue));
      else if (c.id === 'htr') data.push(fmt2(hp));
      else if (c.id === 'had') data.push(fmt2(hdp));
      else data.push(fmt2(rendimentoObj?.extrasPlan?.[c.id] || 0));
    });
    realCols.forEach(c => {
      if (c.id === 'hah') {
        const hReal = parseFloat(real.horas) || 0;
        data.push(fmt2(hReal > 0 ? (real.haDia || 0) / hReal : 0));
      }
      else if (c.id === 'htr') data.push(fmt2(real.horas || 0));
      else if (c.id === 'had') data.push(fmt2(real.haDia || 0));
      else data.push(fmt2(real.extras?.[c.id] || 0));
    });
    data.push(real.motivo || '', real.acaoCorretiva || '', real.obs || '');
    return data.map(v => `"${String(v).replace(/"/g, '""')}"`);
  });
  const csv = [hdrs, ...rows].map(r => r.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `herbtratos_${S.hbEquipe.toLowerCase()}_${todayBR().replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Export PNG da aba inteira ─────────────────────────────────
export async function exportTeamImage() {
  const content = el('tab-equipe')?.querySelector('.card');
  if (!content) return;
  loading(true, 'Gerando imagem...');
  const canvas = await window.html2canvas(content, { backgroundColor: '#eef2f0', scale: 2 });
  const link = document.createElement('a');
  link.download = `HerbTratos_${S.hbEquipe}_${todayBR().replace(/\//g,'-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  loading(false);
  toast('Imagem exportada!', 's');
}
