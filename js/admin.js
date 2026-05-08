// ═══════════════════════════════════════════════════════════════
// admin.js — Aba "Admin" (Frotas, Rendimentos, Operações Agrícolas)
// ═══════════════════════════════════════════════════════════════
// As funções de Rendimentos (renderRend/abrirRend/salvarRend/delRend
// /onRendTurnoChange) referenciam um modal mRend e elementos
// (rendBody, mrCod, mrDescr, etc.) que NÃO existem no HTML atual.
// Foram preservadas como "legado" para fidelidade 1:1: caso o
// modal seja restaurado no HTML futuramente, voltam a funcionar.
// ═══════════════════════════════════════════════════════════════

import { db, doc, setDoc } from './firebase-init.js';
import { S, LS, PP } from './state.js';
import {
  el, gv, sv, txt, tc, norm, fmt2,
  getOperacaoAgricola, getRendimento, getTurnoDisplay, getBdgClass,
  getUniqueTeams, openModal, fecharModal, customConfirm, toast, renderPag
} from './utils.js';
import { saveAdminConfig } from './realtime.js';
import { refreshAll } from './refresh.js';

// ═══════════════════════════════════════════════════════════════
// FROTAS
// ═══════════════════════════════════════════════════════════════
export function renderFrotas() {
  const teamFilter = gv('frotaTeamFilter');
  const f = (el('frotaSrch')?.value || '').toLowerCase().trim();

  const teams = getUniqueTeams();
  const filterEl = el('frotaTeamFilter');
  if (filterEl && filterEl.options.length === 0) {
    filterEl.innerHTML = '<option value="">Todas as Equipes</option>' + teams.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  const items = S.equipamentos.filter(e => {
    const matchTeam = !teamFilter || norm(e.Equipe) === norm(teamFilter);
    if (!matchTeam) return false;

    if (!f) return true;
    const ops = e.operacoesPermitidas || (e.CodOperacao ? [e.CodOperacao] : []);
    const opCods = ops.map(c => String(c)).join(' ');
    const opNames = ops.map(c => getOperacaoAgricola(c)?.Descricao || '').join(' ').toLowerCase();
    return e.Frota.toLowerCase().includes(f) || e.Modelo.toLowerCase().includes(f) || opCods.includes(f) || opNames.includes(f);
  });
  const maxPages = Math.ceil(items.length / PP);
  if (S.pages.frota > maxPages && maxPages > 0) S.pages.frota = maxPages;
  txt('frotaCnt', items.length);
  const pp = PP, start = (S.pages.frota - 1) * pp, page = items.slice(start, start + pp);
  el('frotaBody').innerHTML = page.length ? page.map(e => {
    const idx = S.equipamentos.indexOf(e);
    const equipeBadge = `<span class="badge ${getBdgClass(e.Equipe)}">${e.Equipe||'Tratos'}</span>`;
    const ops = e.operacoesPermitidas || (e.CodOperacao ? [e.CodOperacao] : []);
    const opsDisplay = ops.map(opCod => { const op = getOperacaoAgricola(opCod); return op ? `<span class="badge ${getBdgClass(op.Equipe)}">${op.CodOperacao}</span>` : `<span class="badge">${opCod}</span>`; }).join(' ') || '';
    const descDisplay = ops.map(opCod => tc(getOperacaoAgricola(opCod)?.Descricao || '')).filter(Boolean).join(', ') || tc(e.Operacao || '');
    return `<tr><td>${e.Frota}</td><td class="td-l">${tc(e.Modelo)}</td><td class="td-l">${opsDisplay}</td><td class="td-l">${descDisplay}</td><td>${equipeBadge}</td><td><button class="btn btn-warning btn-xs" onclick="window.HT && HT.abrirFrota(${idx})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="window.HT && HT.delFrota(${idx})"><i class="fas fa-trash"></i></button></td></tr>`;
  }).join('') : '<tr><td colspan="6" class="empty-row">Nenhuma frota.</td></tr>';
  renderPag('frotaPag', items.length, pp, S.pages.frota, 'HT.pagFrota(-1)', 'HT.pagFrota(1)');
}

export function pagFrota(d) { S.pages.frota = Math.max(1, S.pages.frota + d); renderFrotas(); }
export function onFrotaSrchChange() { S.pages.frota = 1; renderFrotas(); }
export function onFrotaTeamChange() { S.pages.frota = 1; renderFrotas(); }

export function populateFrotaOperationsSelect(equipeFilter = '', searchFilter = '') {
  const sel = el('mfOperacoes'); if (!sel) return;
  const currentSelections = (S.editIdx.selectedOps || []).map(String);
  const originalOps = (S.editIdx.originalOps || []).map(String);
  const s = norm(searchFilter);
  sel.innerHTML = '';
  const filtered = S.operacoesAgricolas.filter(op => {
    const matchEquipe = !equipeFilter || norm(op.Equipe) === norm(equipeFilter);
    const matchSearch = !s || String(op.CodOperacao).includes(s) || norm(op.Descricao).includes(s);
    return matchEquipe && matchSearch;
  });
  filtered.forEach(op => {
    const opt = document.createElement('option');
    opt.value = op.CodOperacao;
    opt.text = `${op.CodOperacao} — ${op.Descricao}`;
    if (currentSelections.includes(String(op.CodOperacao))) opt.selected = true;
    if (originalOps.includes(String(op.CodOperacao))) opt.classList.add('op-linked');
    sel.appendChild(opt);
  });
}

export function abrirFrota(idx = null) {
  populateFrotaEquipeSelect(); S.editIdx.frota = idx;
  const e = idx != null ? S.equipamentos[idx] : {};
  const teams = getUniqueTeams();
  const teamVal = teams.find(t => norm(t) === norm(e.Equipe)) || e.Equipe || 'Tratos';
  sv('mfFrota', e.Frota || ''); sv('mfModelo', e.Modelo || ''); sv('mfEquipe', teamVal); sv('mfOpSrch', '');
  let initialOps = e.operacoesPermitidas;
  if (!initialOps && e.CodOperacao) initialOps = [e.CodOperacao];
  const opsList = (initialOps || []).map(String);
  S.editIdx.originalOps = [...opsList];
  S.editIdx.selectedOps = [...opsList];
  populateFrotaOperationsSelect(gv('mfEquipe'), '');
  const desc = S.editIdx.selectedOps.map(opCod => getOperacaoAgricola(opCod)?.Descricao || '').filter(Boolean).join(', ') || (e.Operacao || '');
  sv('mfOp', desc);
  el('mFrotaTitle').textContent = idx != null ? 'Editar Frota' : 'Adicionar Frota';
  openModal('mFrota');
}

export function onFrotaOpChange() {
  const sel = el('mfOperacoes'); if (!sel) return;
  if (!S.editIdx.selectedOps) S.editIdx.selectedOps = [];
  Array.from(sel.options).forEach(opt => {
    const val = String(opt.value);
    const curArr = S.editIdx.selectedOps.map(String);
    const idx = curArr.indexOf(val);
    if (opt.selected && idx === -1) S.editIdx.selectedOps.push(val);
    else if (!opt.selected && idx !== -1) S.editIdx.selectedOps.splice(idx, 1);
  });
  sv('mfOp', S.editIdx.selectedOps.map(opCod => getOperacaoAgricola(opCod)?.Descricao || '').join(', '));
}

export function onFrotaEquipeChange() {
  S.editIdx.selectedOps = [];
  S.editIdx.originalOps = [];
  sv('mfOp', '');
  populateFrotaOperationsSelect(gv('mfEquipe'), gv('mfOpSrch'));
}

export function onFrotaOpSrch() {
  populateFrotaOperationsSelect(gv('mfEquipe'), gv('mfOpSrch'));
}

export async function salvarFrota() {
  const d = { Frota: gv('mfFrota'), Modelo: gv('mfModelo'), Equipe: gv('mfEquipe'), operacoesPermitidas: S.editIdx.selectedOps || [] };
  if (!d.Frota || !d.Modelo || !d.operacoesPermitidas.length) { toast('Preencha Frota, Modelo e selecione ao menos uma Operação!', 'e'); return; }
  if (S.editIdx.frota != null) S.equipamentos[S.editIdx.frota] = d; else S.equipamentos.push(d);
  LS.set('equipamentos', S.equipamentos);
  fecharModal('mFrota'); refreshAll(); toast('Frota salva!', 's');
  saveAdminConfig('equipamentos', S.equipamentos);
}

export async function delFrota(i) {
  if (!(await customConfirm('Excluir Frota', 'Deseja remover este equipamento?'))) return;
  S.equipamentos.splice(i, 1); LS.set('equipamentos', S.equipamentos);
  refreshAll(); toast('Frota removida.', 'w');
  saveAdminConfig('equipamentos', S.equipamentos);
}

function populateFrotaEquipeSelect() {
  const sel = el('mfEquipe'); if (!sel) return;
  const teams = getUniqueTeams();
  sel.innerHTML = teams.map(t => `<option value="${t}">${t}</option>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// RENDIMENTOS — funções legacy (HTML do modal não está montado,
// mas mantemos as funções para fidelidade 1:1 com o monolito)
// ═══════════════════════════════════════════════════════════════
export function renderRend() {
  const body = el('rendBody');
  if (!body) return; // legado: a UI desta seção não existe no HTML
  body.innerHTML = S.rendimentos.length ? S.rendimentos.map((r, i) => {
    const idx = S.rendimentos.indexOf(r), tDisp = getTurnoDisplay(r.Turno, r.SubTurno), subDis = r.SubTurno ? (r.SubTurno === '1' ? '1 turno' : '2 turnos') : '-';
    return `<tr><td class="mono">${r.CodOperacao}</td><td class="td-l">${r.Descricao||''}</td><td>${tDisp}</td><td>${subDis}</td><td>${r.TipoTrator||''}</td><td>${r.UM||'há/h'}</td><td class="bold">${fmt2(r.Rendimento)}</td><td><button class="btn btn-warning btn-xs" onclick="window.HT && HT.abrirRend(${idx})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="window.HT && HT.delRend(${idx})"><i class="fas fa-trash"></i></button></td></tr>`;
  }).join('') : '<tr><td colspan="8" class="empty-row">Nenhum rendimento.</td></tr>';
}

export function abrirRend(i = null) {
  S.editIdx.rend = i; const r = i != null ? S.rendimentos[i] : {};
  sv('mrCod', r.CodOperacao || ''); sv('mrDescr', r.Descricao || ''); sv('mrTurno', r.Turno || '1');
  const subDiv = el('mrSubDiv');
  if (subDiv) subDiv.style.display = (r.Turno === '4' || r.Turno === '5') ? 'block' : 'none';
  sv('mrSub', r.SubTurno || '1'); sv('mrTipo', r.TipoTrator || 'Leve'); sv('mrUM', r.UM || 'há/h'); sv('mrRend', r.Rendimento || '');
  const op = getOperacaoAgricola(r.CodOperacao);
  const team = op ? op.Equipe : 'Tratos';
  const config = S.teamConfigs[team] || [];
  const extras = config.filter(c => c.type !== 'system');
  const extraEl = el('mrExtraPlan');
  if (extraEl) extraEl.innerHTML = extras.map(c => `
    <div class="fg"><label>${c.label} (Meta Planejada)</label><input type="number" step="0.01" class="mr-extra-plan" data-id="${c.id}" value="${r.extrasPlan?.[c.id] || ''}" placeholder="0,00"></div>
  `).join('');
  const titleEl = el('mRendTitle');
  if (titleEl) titleEl.textContent = i != null ? 'Editar Rendimento' : 'Adicionar Rendimento';
  openModal('mRend');
}

export function onRendTurnoChange() {
  const subDiv = el('mrSubDiv');
  if (subDiv) subDiv.style.display = (gv('mrTurno') === '4' || gv('mrTurno') === '5') ? 'block' : 'none';
}

export async function salvarRend() {
  const turno = gv('mrTurno'), subTurno = (turno === '4' || turno === '5') ? gv('mrSub') : null;
  const extrasPlan = {};
  document.querySelectorAll('.mr-extra-plan').forEach(inpt => { extrasPlan[inpt.dataset.id] = parseFloat(inpt.value) || 0; });
  const d = { CodOperacao: gv('mrCod'), Descricao: gv('mrDescr'), Turno: turno, SubTurno: subTurno, TipoTrator: gv('mrTipo'), UM: gv('mrUM') || 'há/h', Rendimento: parseFloat(gv('mrRend')) || 0, extrasPlan };
  if (!d.CodOperacao || !d.Rendimento) { toast('Preencha Cód. e Rendimento!', 'e'); return; }
  if (S.editIdx.rend != null) S.rendimentos[S.editIdx.rend] = d; else S.rendimentos.push(d);
  LS.set('rendimentos', S.rendimentos); fecharModal('mRend'); refreshAll(); toast('Rendimento salvo!', 's');
  saveAdminConfig('rendimentos', S.rendimentos);
}

export async function delRend(i) {
  if (!(await customConfirm('Excluir', 'Remover esta regra?'))) return;
  S.rendimentos.splice(i, 1); LS.set('rendimentos', S.rendimentos);
  refreshAll(); saveAdminConfig('rendimentos', S.rendimentos);
}

// ═══════════════════════════════════════════════════════════════
// OPERAÇÕES AGRÍCOLAS
// ═══════════════════════════════════════════════════════════════
export function populateOpEquipeSelect() {
  const sel = el('moEquipe'); if (!sel) return;
  const teams = getUniqueTeams();
  sel.innerHTML = '<option value="">Selecione...</option>' +
    teams.map(t => `<option value="${t}">${t}</option>`).join('') +
    '<option value="NEW" style="font-weight:bold; color:var(--g800)">+ Criar Nova Equipe</option>';
}

export function onOpEquipeChange() {
  const val = gv('moEquipe'), isNew = val === 'NEW';
  el('moNewEquipeGrp').style.display = isNew ? 'block' : 'none';
  if (isNew) el('moNewEquipe').focus();
  const team = isNew ? '' : val;
  const teamKey = team ? (Object.keys(S.teamConfigs).find(k => norm(k) === norm(team)) || team) : '';
  const cfg = S.teamConfigs[teamKey] || [];
  const extras = cfg.filter(c => c.type !== 'system');
  const o = S.editIdx.ops !== null ? S.operacoesAgricolas[S.editIdx.ops] : {};
  el('moExtraPlan').innerHTML = extras.map(c => `
    <div class="fg" style="margin-bottom:11px"><label>${c.label} (Meta Planejada)</label><input type="number" step="0.01" class="mo-extra-plan" data-id="${c.id}" value="${o.extrasPlan?.[c.id] || ''}" placeholder="0,00"></div>
  `).join('');
}

export function onOpsSrchChange() { renderOps(); }

export function renderOps() {
  const teamFilter = gv('opsTeamFilter');
  const f = (el('opsSrch')?.value || '').toLowerCase().trim();
  const teams = getUniqueTeams();
  const filterEl = el('opsTeamFilter');
  if (filterEl && filterEl.options.length === 0) {
    filterEl.innerHTML = '<option value="">Todas as Equipes</option>' + teams.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  const items = S.operacoesAgricolas.filter(o => {
    const matchSearch = !f || String(o.CodOperacao).toLowerCase().includes(f) || norm(o.Descricao).includes(f);
    const matchTeam = !teamFilter || norm(o.Equipe) === norm(teamFilter);
    return matchSearch && matchTeam;
  });

  const teamKey = teamFilter ? (Object.keys(S.teamConfigs).find(k => norm(k) === norm(teamFilter)) || teamFilter) : '';
  const cfg = S.teamConfigs[teamKey] || [];
  const extraCols = cfg.filter(c => c.type !== 'system');

  const head = el('opsHead');
  if (head) {
    head.innerHTML = `<tr class="th-base"><th>Cód.</th><th>Descrição</th><th>Equipe</th><th>Rendimento (Há/h)</th><th>Horas Base</th><th>Rendimento Dia</th>${extraCols.map(c => `<th>${c.label} Plan.</th>`).join('')}<th>Turno</th><th>SubTurno</th><th>Tipo Trator</th><th>Ações</th></tr>`;
  }

  txt('opsCnt', items.length);
  el('opsBody').innerHTML = items.map(o => {
    const idx = S.operacoesAgricolas.indexOf(o);
    const rendDia = (parseFloat(o.Total) || 0) * (parseFloat(o.HorasBase) || 3.95);
    const tDisp = getTurnoDisplay(o.Turno, o.SubTurno);
    const subLabel = o.SubTurno ? (o.SubTurno === '1' ? '1 turno' : '2 turnos') : '-';

    return `<tr>
      <td style="font-weight:700;font-family:monospace">${o.CodOperacao}</td>
      <td style="text-align:left">${tc(o.Descricao)}</td>
      <td><span class="badge ${getBdgClass(o.Equipe)}">${tc(o.Equipe)}</span></td>
      <td class="bold">${fmt2(o.Total)}</td>
      <td class="bold">${fmt2(o.HorasBase || 3.95)}</td>
      <td class="bold" style="color:var(--b800)">${fmt2(rendDia)}</td>
      ${extraCols.map(c => `<td class="bold" style="color:var(--b800)">${fmt2(o.extrasPlan?.[c.id] || 0)}</td>`).join('')}
      <td>${tDisp}</td>
      <td>${subLabel}</td>
      <td>${o.TipoTrator || ''}</td>
      <td><button class="btn btn-warning btn-xs" onclick="window.HT && HT.abrirOpAgric(${idx})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="window.HT && HT.delOpAgric(${idx})"><i class="fas fa-trash"></i></button></td></tr>`;
  }).join('');
}

export function abrirOpAgric(idx = null) {
  populateOpEquipeSelect(); S.editIdx.ops = idx;
  const o = idx != null ? S.operacoesAgricolas[idx] : {};
  sv('moCod', o.CodOperacao || '');
  sv('moDesc', o.Descricao || '');
  const teams = getUniqueTeams();
  const teamVal = teams.find(t => norm(t) === norm(o.Equipe)) || o.Equipe || 'Tratos';
  sv('moEquipe', teamVal); onOpEquipeChange();
  sv('moTotal', o.Total || '1.0');
  sv('moHorasBase', o.HorasBase || '3.95');
  sv('moTurno', o.Turno || '1');
  el('moSubDiv').style.display = (o.Turno === '4' || o.Turno === '5') ? 'block' : 'none';
  sv('moSub', o.SubTurno || '1'); sv('moTipo', o.TipoTrator || 'Leve');
  el('mOpAgricTitle').textContent = idx != null ? 'Editar Operação' : 'Adicionar Operação';
  openModal('mOpAgric');
}

export function onOpTurnoChange() {
  el('moSubDiv').style.display = (gv('moTurno') === '4' || gv('moTurno') === '5') ? 'block' : 'none';
}

export async function salvarOpAgric() {
  let equipe = gv('moEquipe');
  if (!equipe) { toast('Selecione uma equipe!', 'w'); return; }
  if (equipe === 'NEW') {
    if (S.session?.Nivel !== 'master') { toast('Apenas Master pode criar novas equipes.', 'e'); return; }
    equipe = gv('moNewEquipe').trim();
    if (!equipe) { toast('Informe o nome da nova equipe!', 'e'); return; }
    equipe = equipe.charAt(0).toUpperCase() + equipe.slice(1);
  }
  const turno = gv('moTurno');
  const extrasPlan = {};
  document.querySelectorAll('.mo-extra-plan').forEach(inpt => { extrasPlan[inpt.dataset.id] = parseFloat(inpt.value) || 0; });
  const d = {
    CodOperacao: gv('moCod'),
    Descricao: gv('moDesc'),
    Equipe: equipe,
    Total: parseFloat(gv('moTotal')) || 0,
    HorasBase: parseFloat(gv('moHorasBase')) || 3.95,
    Rendimento: parseFloat(gv('moTotal')) || 0,
    Turno: turno,
    SubTurno: (turno === '4' || turno === '5') ? gv('moSub') : null,
    TipoTrator: gv('moTipo'),
    extrasPlan
  };
  if (!d.CodOperacao || !d.Descricao) { toast('Preencha Código e Descrição!', 'e'); return; }
  if (S.editIdx.ops != null) S.operacoesAgricolas[S.editIdx.ops] = d; else S.operacoesAgricolas.push(d);
  LS.set('operacoesAgricolas', S.operacoesAgricolas);
  fecharModal('mOpAgric'); refreshAll(); toast('Operação salva!', 's');
  saveAdminConfig('operacoesAgricolas', S.operacoesAgricolas);
}

export async function delOpAgric(i) {
  if (!(await customConfirm('Excluir', 'Remover esta operação?'))) return;
  S.operacoesAgricolas.splice(i, 1); LS.set('operacoesAgricolas', S.operacoesAgricolas);
  refreshAll(); toast('Operação removida.', 'w');
  saveAdminConfig('operacoesAgricolas', S.operacoesAgricolas);
}
