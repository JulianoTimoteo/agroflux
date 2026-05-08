// ═══════════════════════════════════════════════════════════════
// lancamento.js — Aba "Campo": formulário de lançamento + pendentes
// ═══════════════════════════════════════════════════════════════
// Os "registros pendentes" vivem dentro da MESMA aba HTML do
// formulário de lançamento (id="tab-campo"). Por coesão funcional
// (entrada, validação, persistência local e visualização do que
// ainda não foi sincronizado), todo o ciclo de pendentes vive
// neste módulo.
// ═══════════════════════════════════════════════════════════════

import { auth } from './firebase-init.js';
import { S, LS, PP } from './state.js';
import {
  el, gv, sv, txt, tc, norm, fmt2, todayBR,
  getOperacaoAgricola, getRendimento, calcHP,
  getSelectionStyle, getUniqueTeams,
  toast, customConfirm, playSuccessSound, renderPag
} from './utils.js';
import { refreshAll } from './refresh.js';

// ── Tabs de equipe e seleção de frota ─────────────────────────
export function populateCampoFrotas() {
  // Inicializa melhorias mobile na primeira chamada
  initCampoMobile();

  const s = S.session; const equipesPermitidas = s?.Equipes || [];
  const teamsData = getUniqueTeams();
  const teamMap = {}; teamsData.forEach(t => teamMap[norm(t).replace(/\s+/g, '')] = t);
  
  // Define quais chaves de equipe o usuário pode ver
  const allowedTeamKeys = (s?.Nivel === 'master') ? Object.keys(teamMap) : equipesPermitidas.filter(a => teamMap[a]);

  // Validação Crítica: Se a equipe atual não estiver na lista permitida do usuário, muda para a primeira permitida
  const currentKey = Object.keys(teamMap).find(k => teamMap[k] === S.campoEquipe);
  if (!allowedTeamKeys.includes(currentKey)) {
    S.campoEquipe = allowedTeamKeys.length > 0 ? teamMap[allowedTeamKeys[0]] : '';
  }

  const tabsCont = el('cEquipeTabs');
  if (tabsCont) {
    tabsCont.innerHTML = allowedTeamKeys.map(t => `
      <button class="dtab ${S.campoEquipe === teamMap[t] ? 'active' : ''}"
              onclick="window.HT && HT.setCampoEquipe('${teamMap[t]}')" ${getSelectionStyle(teamMap[t], S.campoEquipe === teamMap[t])}>
        ${tc(teamMap[t])}
      </button>
    `).join('');
  }
  const frotaSel = el('cFrota');
  if (!frotaSel) return;
  const frotasEquipe = S.equipamentos.filter(e => {
    if (norm(e.Equipe) === norm(S.campoEquipe)) return true;
    const ops = e.operacoesPermitidas || (e.CodOperacao ? [e.CodOperacao] : []);
    return ops.some(opCod => {
      const op = getOperacaoAgricola(opCod);
      return op && norm(op.Equipe || op.equipe) === norm(S.campoEquipe);
    });
  });
  const uniqueFrotas = [...new Set(frotasEquipe.map(e => e.Frota))].sort();
  const blank = '<option value="">Selecione...</option>';
  frotaSel.disabled = !S.campoEquipe;
  frotaSel.innerHTML = S.campoEquipe ? blank + uniqueFrotas.map(f => `<option value="${f}">${f}</option>`).join('') : '<option value="">Selecione a equipe primeiro...</option>';
  sv('cModelo', '');
  el('cCodOp').innerHTML = '<option value="">Aguardando frota...</option>';
  el('cCodOp').disabled = true;
  sv('cOp', '');
  el('planBox').style.display = 'none';
  onFrotaChange();
}

export function setCampoEquipe(team) {
  S.campoEquipe = team;
  S.pages.pend = 1;
  populateCampoFrotas();
  renderPendentes();
}

export function onFrotaChange() {
  const frota = gv('cFrota');
  const blank = '<option value="">Selecione...</option>';
  const config = S.teamConfigs[S.campoEquipe] || [
    { id: 'hah', label: 'Há/h', type: 'system' },
    { id: 'htr', label: 'Horas Trab.', type: 'system' },
    { id: 'had', label: 'Há/Dia', type: 'system' }
  ];
  const extras = config.filter(c => {
    const lbl = (c.label || '').toLowerCase();
    return c.type !== 'system' && !['had','htr','hah'].includes(c.id) &&
           !lbl.includes('há/dia') && !lbl.includes('horas trab') && !lbl.includes('há/h') &&
           c.showReal !== false;
  });
  el('cExtraFields').innerHTML = extras.map(c => `
    <div class="fg"><label>${c.label} (Real.)</label><input type="number" step="0.01" class="c-extra-in" data-id="${c.id}" oninput="window.HT && HT._verificarMeta()" placeholder="0,00"></div>
  `).join('');
  if (!frota) {
    sv('cModelo', ''); el('cCodOp').innerHTML = blank; el('cCodOp').disabled = true; sv('cOp', '');
    el('planBox').style.display = 'none';
    return;
  }
  const selectedFrota = S.equipamentos.find(e => e.Frota === frota);
  if (selectedFrota) {
    el('cCodOp').disabled = false;
    sv('cModelo', selectedFrota.Modelo || '');
    // Garante comparação de string para evitar erro de tipo (número vs texto)
    const permitidas = (selectedFrota.operacoesPermitidas || []).map(String);
    const allowedOps = S.operacoesAgricolas.filter(op =>
      permitidas.includes(String(op.CodOperacao)) && norm(op.Equipe) === norm(S.campoEquipe)
    );
    el('cCodOp').innerHTML = blank + allowedOps.map(op => `<option value="${op.CodOperacao}">${op.CodOperacao} - ${op.Descricao}</option>`).join('');
    sv('cOp', '');
  } else {
    sv('cModelo', ''); el('cCodOp').innerHTML = blank; sv('cOp', '');
  }
  _atualizarPlan();
}

export function onCodChange() {
  const cod = gv('cCodOp');
  const op = getOperacaoAgricola(cod); el('cTurno').disabled = !cod;
  sv('cOp', op ? op.Descricao : '');
  _atualizarPlan();
}

export function onTurnoChange() {
  const t = gv('cTurno');
  el('cSubDiv').style.display = (t === '4' || t === '5') ? 'block' : 'none';
  _atualizarPlan();
}

function _atualizarPlan() {
  const cod = gv('cCodOp'), turno = gv('cTurno'), sub = gv('cSub');
  if (!cod || !turno) { el('planBox').style.display = 'none'; return; }
  const rendObj = getRendimento(cod), rend = parseFloat(rendObj?.Rendimento || 0), hp = calcHP(cod, turno, sub), hdp = rend * hp;
  S.metaPlan = hdp;
  txt('pbHah', fmt2(rend)); txt('pbHoras', fmt2(hp)); txt('pbHaDia', fmt2(hdp));
  const config = S.teamConfigs[S.campoEquipe] || [];
  const extras = config.filter(c => c.type !== 'system');
  // Exibe apenas as metas extras que possuem valor planejado definido (> 0) no painel azul
  // Exibe apenas as metas extras que possuem valor planejado definido E que devem ser mostradas no planejado
  const extrasComMeta = extras.filter(c => c.showPlan !== false && (parseFloat(rendObj?.extrasPlan?.[c.id]) || 0) > 0);
  el('pbExtraMetas').innerHTML = extrasComMeta.map(c => `
    <div class="pbi"><label>${c.label} Plan.</label><span>${fmt2(rendObj?.extrasPlan?.[c.id] || 0)}</span></div>
  `).join('');
  el('planBox').style.display = 'flex';
  _verificarMeta();
}

export function onHorasIn() {
  const hReal = parseFloat(gv('cHoras')) || 0;
  const hPlan = parseFloat(el('pbHoras')?.textContent) || 8;
  const diasOperacao = hPlan / 8;
  if (diasOperacao > 0) sv('cHaDia', fmt2(hReal / diasOperacao));
  _verificarMeta();
}

export function onHaDiaIn() { _verificarMeta(); }

export function _verificarMeta() {
  const hd = parseFloat(gv('cHaDia')) || 0;
  const hReal = parseFloat(gv('cHoras')) || 0;

  let status = 'planejado';
  if (hReal > 0) {
    let atingiu = (hd >= S.metaPlan);

    // Verifica metas de colunas extras (ex: volume m³)
    const cod = gv('cCodOp');
    const rendObj = getRendimento(cod);
    document.querySelectorAll('.c-extra-in').forEach(input => {
      const metaExtra = parseFloat(rendObj?.extrasPlan?.[input.dataset.id]) || 0;
      const realExtra = parseFloat(input.value) || 0;
      if (metaExtra > 0 && realExtra < metaExtra) atingiu = false;
    });

    status = atingiu ? 'atingido' : 'nao-atingido';
  }

  const tag = el('metaTag');
  const motivoEl = el('cMotivo');
  if (!tag || !motivoEl) return;
  if (status === 'atingido') {
    tag.innerHTML = '<span class="badge-meta" style="background:var(--success)"><i class="fas fa-check-circle"></i> Atingido</span>';
    sv('cMotivo', 'Meta Atingida!');
  } else if (status === 'nao-atingido') {
    tag.innerHTML = '<span class="badge-meta" style="background:var(--danger)"><i class="fas fa-times-circle"></i> Não Atingido</span>';
    if (gv('cMotivo') === 'Meta Atingida!') sv('cMotivo', '');
  } else {
    tag.innerHTML = '<span class="badge-meta" style="background:var(--b800)"><i class="fas fa-clock"></i> Planejado</span>';
  }
}

export function limparCampo() {
  ['cFrota','cTurno','cSub'].forEach(id => { const e = el(id); if (e) e.value = ''; });
  el('cCodOp').innerHTML = '<option value="">Selecione...</option>';
  ['cModelo','cHoras','cHaDia','cMotivo','cAcao'].forEach(id => { const e = el(id); if (e) e.value = ''; });
  el('cExtraFields').innerHTML = '';
  el('planBox').style.display = 'none'; el('metaTag').innerHTML = ''; el('cSubDiv').style.display = 'none';
  document.querySelectorAll('.campo-erro').forEach(e => e.classList.remove('campo-erro'));
  ['cntMot','cntAcao'].forEach(id => txt(id, '0/300'));
  S.metaPlan = 0; populateCampoFrotas();
}

function _validarFormCampo() {
  const cod = gv('cCodOp'), op = gv('cOp'), fr = gv('cFrota'), mod = gv('cModelo'), turno = gv('cTurno'), sub = gv('cSub');
  const horas = parseFloat(gv('cHoras')) || 0, haDia = parseFloat(gv('cHaDia')) || 0;
  const motivo = gv('cMotivo'), acao = gv('cAcao');
  document.querySelectorAll('.campo-erro').forEach(e => e.classList.remove('campo-erro'));
  if (!fr || !cod || horas <= 0) {
    if (!fr) el('cFrota').classList.add('campo-erro');
    if (!cod) el('cCodOp').classList.add('campo-erro');
    if (horas <= 0) el('cHoras').classList.add('campo-erro');
    toast('Preencha os campos obrigatórios!', 'w'); return null;
  }
  const rend = getRendimento(cod), hp = calcHP(cod, turno, sub), mp = (parseFloat(rend?.Rendimento) || 0) * hp;
  const metaOk = mp > 0 && haDia >= mp;
  if (!metaOk) {
    if (!motivo || motivo === 'Meta Atingida!') { el('cMotivo').classList.add('campo-erro'); toast('Motivo obrigatório se a meta não for atingida!', 'e'); return null; }
    if (!acao || acao === 'Meta Atingida!') { el('cAcao').classList.add('campo-erro'); toast('Ação Corretiva obrigatória!', 'e'); return null; }
  }
  const extras = {};
  document.querySelectorAll('.c-extra-in').forEach(input => { extras[input.dataset.id] = parseFloat(input.value) || 0; });
  return {
    id: Date.now(), data: todayBR(), codOperacao: cod, descricao: op,
    frota: fr, modelo: mod, turno, haDia, horasReal: horas,
    motivo: motivo || '--', acao: acao || '--', observacao: '--',
    timestamp: new Date().toISOString(),
    extras,
    uid: auth.currentUser?.uid || ''
  };
}

export async function salvarCampo() {
  const record = _validarFormCampo();
  if (!record) return;
  let finalRecord = { ...record };
  const existingPendingIndex = S.pendentes.findIndex(p =>
    p.codOperacao === record.codOperacao && p.frota === record.frota &&
    p.modelo === record.modelo && p.data === record.data
  );
  if (existingPendingIndex !== -1) {
    const existingRecord = S.pendentes[existingPendingIndex];
    const confirmSum = await customConfirm("Registro Duplicado", `Já existe um registro para ${record.frota} - ${record.codOperacao} hoje. Deseja somar os valores?`);
    if (confirmSum) {
      existingRecord.horasReal += record.horasReal;
      existingRecord.haDia += record.haDia;
      for (const key in record.extras) {
        if (record.extras.hasOwnProperty(key)) existingRecord.extras[key] = (existingRecord.extras[key] || 0) + record.extras[key];
      }
      existingRecord.timestamp = new Date().toISOString();
      finalRecord = existingRecord;
      toast('Valores somados!', 's');
    } else {
      limparCampo(); toast('Registro não salvo.', 'i'); return;
    }
  } else {
    S.pendentes.push(record);
    toast('Registro salvo!', 's');
  }
  const key = `${String(finalRecord.codOperacao).trim()}|${(finalRecord.modelo || '').trim()}|${String(finalRecord.frota).trim()}`;
  S.realizados[key] = { horas: finalRecord.horasReal, haDia: finalRecord.haDia, motivo: finalRecord.motivo, acaoCorretiva: finalRecord.acao, obs: finalRecord.observacao, extras: finalRecord.extras };
  LS.set('realizados', S.realizados);
  LS.set('pendentes', S.pendentes);
  limparCampo(); refreshAll(); playSuccessSound();
}

// ── Lista de pendentes ────────────────────────────────────────
export function renderPendentes() {
  const filtered = S.pendentes.filter(r => {
    const op = getOperacaoAgricola(r.codOperacao);
    return op && norm(op.Equipe || op.equipe) === norm(S.campoEquipe);
  });

  const config = S.teamConfigs[S.campoEquipe] || [];
  const extraCols = config.filter(c => c.type !== 'system');

  const pp = PP, start = (S.pages.pend - 1) * pp, page = filtered.slice(start, start + pp);
  const tbody = el('pendBody'); if (!tbody) return;
  const thead = el('tab-campo')?.querySelector('thead tr.th-base');

  if (thead) {
    thead.innerHTML = `
      <th style="width:30px"><input type="checkbox" onclick="window.HT && HT.toggleSelPend(this.checked)"></th>
      <th>Cód.</th><th>Operação</th><th>Frota</th><th>Modelo</th><th>Horas</th><th>Há/Dia</th>
      ${extraCols.map(c => `<th>${c.label}</th>`).join('')}
      <th>Data</th><th>Status</th><th>Ação <button id="syncBtnHeader" class="btn btn-success btn-xs" onclick="window.HT && HT.sincronizarCampo()" title="Sincronizar"><i class="fas fa-fire"></i></button></th>
    `;
  }

  txt('pendCnt', filtered.length);
  const btn = el('syncBtnHeader');
  if (btn) {
    btn.disabled = filtered.length === 0;
    btn.classList.toggle('btn-pulse', filtered.length > 0);
  }

  tbody.innerHTML = page.length ? page.map(r =>
    `<tr>
      <td data-label="Selecionar"><input type="checkbox" class="pend-check" data-id="${r.id}"></td>
      <td data-label="Cód." class="mono">${r.codOperacao}</td>
      <td data-label="Operação" class="td-l">${tc(r.descricao)}</td>
      <td data-label="Frota">${r.frota}</td>
      <td data-label="Modelo" class="td-l">${tc(r.modelo)}</td>
      <td data-label="Horas">${fmt2(r.horasReal)}</td>
      <td data-label="Há/Dia">${fmt2(r.haDia)}</td>
      ${extraCols.map(c => `<td data-label="${c.label}">${fmt2(r.extras?.[c.id] || 0)}</td>`).join('')}
      <td data-label="Data" style="font-size:.6rem">${r.data||''}</td>
      <td data-label="Status"><span class="badge bdg-pendente">Pendente</span></td>
      <td data-label="Ação">
        <button class="btn btn-warning btn-xs" onclick="window.HT && HT.editarPend(${r.id})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-xs" onclick="window.HT && HT.delPend(${r.id})"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`
  ).join('') : `<tr><td colspan="${10 + extraCols.length}" class="empty-row"><i class="fas fa-check-circle" style="color:#4caf50"></i> Nenhum pendente</td></tr>`;
  renderPag('pendPag', filtered.length, pp, S.pages.pend, 'HT.pagPend(-1)', 'HT.pagPend(1)');
}

export function toggleSelPend(v) {
  document.querySelectorAll('.pend-check').forEach(c => c.checked = v);
}

export function editarPend(id) {
  const idx = S.pendentes.findIndex(p => p.id === id);
  if (idx === -1) return;
  const r = S.pendentes[idx];
  setCampoEquipe(getOperacaoAgricola(r.codOperacao)?.Equipe || S.campoEquipe);
  sv('cFrota', r.frota); onFrotaChange();
  sv('cCodOp', r.codOperacao); onCodChange();
  sv('cTurno', r.turno); onTurnoChange();
  sv('cHoras', r.horasReal); sv('cHaDia', r.haDia);
  sv('cMotivo', r.motivo); sv('cAcao', r.acao);
  setTimeout(() => {
    document.querySelectorAll('.c-extra-in').forEach(input => {
      if (r.extras && r.extras[input.dataset.id]) input.value = r.extras[input.dataset.id];
    });
  }, 50);
  S.pendentes.splice(idx, 1);
  LS.set('pendentes', S.pendentes);
  renderPendentes();
  toast('Dados carregados para edição.', 's');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function pagPend(d) {
  S.pages.pend = Math.max(1, S.pages.pend + d);
  renderPendentes();
}

export async function delPend(id) {
  if (!(await customConfirm('Excluir', 'Deseja excluir este registro pendente?'))) return;
  S.pendentes = S.pendentes.filter(p => p.id !== id);
  LS.set('pendentes', S.pendentes);
  renderPendentes();
  toast('Removido.', 'w');
}

// ═══════════════════════════════════════════════════════════════
// initCampoMobile — Experiência especial da aba Campo no celular
// Chamado automaticamente em populateCampoFrotas (primeira vez)
// ═══════════════════════════════════════════════════════════════
let _campoMobileReady = false;

export function initCampoMobile() {
  // Só inicializa uma vez e somente em dispositivos mobile
  if (_campoMobileReady) return;
  _campoMobileReady = true;

  const campoSection = el('tab-campo');
  if (!campoSection) return;

  // ── Sequência fixa de campos para navegação por Enter/Next ───
  const FIELD_ORDER = ['cFrota', 'cCodOp', 'cTurno', 'cSub', 'cHoras', 'cHaDia', 'cMotivo', 'cAcao'];

  // Retorna a sequência atual levando em conta campos ocultos (ex: cSub)
  function getVisibleSequence() {
    return FIELD_ORDER.filter(id => {
      const e = el(id);
      if (!e) return false;
      if (id === 'cSub') return el('cSubDiv')?.style.display !== 'none';
      return true;
    });
  }

  // Foca no próximo campo da sequência
  function focusNext(fromIdOrEl) {
    const seq   = getVisibleSequence();
    const extras = Array.from(document.querySelectorAll('.c-extra-in'));

    // Monta sequência completa: campos fixos + extras entre cHaDia e cMotivo
    const haDiaIdx = seq.indexOf('cHaDia');
    const full = [
      ...seq.slice(0, haDiaIdx + 1),
      ...extras,                           // inputs dinâmicos
      ...seq.slice(haDiaIdx + 1)
    ];

    // Descobre índice atual
    let idx;
    if (typeof fromIdOrEl === 'string') {
      idx = full.indexOf(fromIdOrEl);
    } else {
      idx = full.indexOf(fromIdOrEl);      // elemento DOM dos extras
    }

    if (idx === -1 || idx >= full.length - 1) return;

    const next = full[idx + 1];

    if (typeof next === 'string') {
      const target = el(next);
      if (!target) return;
      target.focus();
      // Rola suavemente para o campo com margem de cabeçalho
      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    } else if (next instanceof Element) {
      next.focus();
      setTimeout(() => {
        const rect = next.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
          next.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    }
  }

  // ── Efeito zoom/ênfase no campo com foco ────────────────────
  campoSection.addEventListener('focusin', (e) => {
    const inp = e.target;
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(inp.tagName)) return;

    // Remove ênfase anterior
    campoSection.querySelectorAll('.fg.campo-focused').forEach(fg => fg.classList.remove('campo-focused'));

    // Adiciona ênfase no .fg pai
    const fg = inp.closest('.fg');
    if (fg) {
      fg.classList.add('campo-focused');
      // Rola para o campo se estiver fora da área visível
      setTimeout(() => {
        const rect = fg.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 100) {
          fg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, true);

  // Remove ênfase ao sair do campo
  campoSection.addEventListener('focusout', (e) => {
    const fg = e.target.closest('.fg');
    if (!fg) return;
    setTimeout(() => {
      if (!fg.contains(document.activeElement)) {
        fg.classList.remove('campo-focused');
      }
    }, 150);
  }, true);

  // ── Navegação por Enter / Next no teclado ───────────────────
  campoSection.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = e.target;

    if (t.tagName === 'TEXTAREA') {
      // Shift+Enter = quebra de linha normal; Enter simples = próximo campo
      if (e.shiftKey) return;
      e.preventDefault();
      focusNext(t.id);
      return;
    }

    if (t.tagName === 'INPUT') {
      e.preventDefault();
      if (t.classList.contains('c-extra-in')) {
        focusNext(t);    // elemento DOM para extras dinâmicos
      } else {
        focusNext(t.id);
      }
      return;
    }

    if (t.tagName === 'SELECT') {
      e.preventDefault();
      focusNext(t.id);
    }
  });

  // ── Auto-avanço após selecionar dropdown (só em touch) ──────
  // Avança para o próximo campo automaticamente após escolher
  // uma opção no select nativo do celular.
  if ('ontouchstart' in window) {
    const mobileSelects = ['cFrota', 'cCodOp', 'cTurno', 'cSub'];
    mobileSelects.forEach(id => {
      const e = el(id);
      if (!e) return;
      e.addEventListener('change', () => {
        // Aguarda os onchange originais (HT.onFrotaChange etc.) terminarem
        // Aumentado para 450ms para garantir que o DOM mobile atualizou
        setTimeout(() => focusNext(id), 450);
      });
    });
  }

  // ── Indicador de progresso do formulário (mobile) ───────────
  _atualizarProgressoCampo();
  campoSection.addEventListener('change', _atualizarProgressoCampo);
  campoSection.addEventListener('input', _atualizarProgressoCampo);
}

// Barra de progresso visual do formulário no mobile
function _atualizarProgressoCampo() {
  const indicator = el('campoProgressBar');
  if (!indicator) return;

  const campos = [
    { id: 'cFrota',  fn: v => !!v },
    { id: 'cCodOp',  fn: v => !!v },
    { id: 'cTurno',  fn: v => !!v },
    { id: 'cHoras',  fn: v => parseFloat(v) > 0 },
    { id: 'cHaDia',  fn: v => parseFloat(v) > 0 },
  ];

  const total     = campos.length;
  const preenchidos = campos.filter(c => c.fn(gv(c.id))).length;
  const pct       = Math.round((preenchidos / total) * 100);

  indicator.style.width = pct + '%';
  indicator.style.background = pct === 100
    ? 'var(--g600)'
    : pct >= 60
    ? '#ffa726'
    : 'var(--b800)';
}
