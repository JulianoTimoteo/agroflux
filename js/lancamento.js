// ═══════════════════════════════════════════════════════════════
// lancamento.js — Aba "Campo": formulário de lançamento
// ═══════════════════════════════════════════════════════════════
//
// ARQUITETURA SIMPLIFICADA (estilo OS CAMPO):
//
//   🔥 FIRESTORE = ÚNICA FONTE DE VERDADE
//   
//   FLUXO:
//     1. Usuário preenche formulário
//     2. Clica em SALVAR
//     3. addDoc direto no Firestore (via saveCampoRecord)
//     4. onSnapshot atualiza S.realizados automaticamente
//     5. UI reflete mudança em tempo real
//
//   SEM FILA OFFLINE: se offline, mostra erro e não salva
//   SEM BOTÃO "Sincronizar": automático
// ═══════════════════════════════════════════════════════════════

import { auth } from './firebase-init.js';
import { S, LS, PP } from './state.js';
import {
  el, gv, sv, txt, tc, norm, fmt2, todayBR,
  getOperacaoAgricola, getRendimento, calcHP,
  getSelectionStyle, getUniqueTeams,
  toast, customConfirm, playSuccessSound, renderPag, loading
} from './utils.js';
import { refreshAll } from './refresh.js';
import { saveCampoRecord } from './realtime.js';

// ── Tabs de equipe e seleção de frota ─────────────────────────
export function populateCampoFrotas() {
  initCampoMobile();

  const s = S.session; const equipesPermitidas = s?.Equipes || [];
  const teamsData = getUniqueTeams();
  const teamMap = {}; teamsData.forEach(t => teamMap[norm(t).replace(/\s+/g, '')] = t);
  
  const allowedTeamKeys = (s?.Nivel === 'master') ? Object.keys(teamMap) : equipesPermitidas.filter(a => teamMap[a]);

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
  if (auth.currentUser) LS.set('campoEquipe_' + auth.currentUser.uid, team);
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
  const op = getOperacaoAgricola(cod); 
  el('cTurno').disabled = !cod;
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
    if (gv('cMotivo') === '') sv('cMotivo', 'Meta Atingida!');
  } else if (status === 'nao-atingido') {
    tag.innerHTML = '<span class="badge-meta" style="background:var(--danger)"><i class="fas fa-times-circle"></i> Não Atingido</span>';
    if (gv('cMotivo') === 'Meta Atingida!') sv('cMotivo', '');
  } else {
    tag.innerHTML = '<span class="badge-meta" style="background:var(--b800)"><i class="fas fa-clock"></i> Planejado</span>';
  }
}

export function limparCampo() {
  ['cData','cFrota','cTurno','cSub'].forEach(id => { const e = el(id); if (e) e.value = ''; });
  const dateIn = el('cData'); if (dateIn) { const d = new Date(); dateIn.value = d.toISOString().split('T')[0]; }
  el('cCodOp').innerHTML = '<option value="">Selecione...</option>';
  ['cModelo','cHoras','cHaDia','cMotivo','cAcao'].forEach(id => { const e = el(id); if (e) e.value = ''; });
  el('cExtraFields').innerHTML = '';
  el('planBox').style.display = 'none'; el('metaTag').innerHTML = ''; el('cSubDiv').style.display = 'none';
  document.querySelectorAll('.campo-erro').forEach(e => e.classList.remove('campo-erro'));
  ['cntMot','cntAcao'].forEach(id => txt(id, '0/300'));
  clearCampoDraft();
  S.metaPlan = 0; 
  populateCampoFrotas();
}

// ── Gerenciamento de Rascunho (Draft) ─────────────────────────
export function saveCampoDraft() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const draft = {
    data: gv('cData'), frota: gv('cFrota'), cod: gv('cCodOp'),
    turno: gv('cTurno'), sub: gv('cSub'), horas: gv('cHoras'),
    haDia: gv('cHaDia'), motivo: gv('cMotivo'), acao: gv('cAcao'),
    extras: {}
  };
  document.querySelectorAll('.c-extra-in').forEach(i => { draft.extras[i.dataset.id] = i.value; });
  LS.set('draft_campo_' + uid, draft);
}

export function restoreCampoDraft() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const d = LS.get('draft_campo_' + uid);
  if (!d) return;
  if (d.data) sv('cData', d.data);
  
  if (d.frota) { 
    sv('cFrota', d.frota); 
    onFrotaChange(); 
    if (d.cod) { 
      sv('cCodOp', d.cod); 
      onCodChange(); 
    }
  }
  
  if (d.turno) { sv('cTurno', d.turno); onTurnoChange(); }
  if (d.sub) sv('cSub', d.sub);
  if (d.horas) sv('cHoras', d.horas);
  if (d.haDia) sv('cHaDia', d.haDia);
  if (d.motivo) sv('cMotivo', d.motivo);
  if (d.acao) sv('cAcao', d.acao);
  
  setTimeout(() => {
    document.querySelectorAll('.c-extra-in').forEach(i => { if (d.extras?.[i.dataset.id]) i.value = d.extras[i.dataset.id]; });
    _verificarMeta();
  }, 500);
}

export function clearCampoDraft() {
  const uid = auth.currentUser?.uid;
  if (uid) LS.rm('draft_campo_' + uid);
}

// ── LIMPAR CACHE LOCAL (pendentes antigos) ────────────────────
export function limparCacheLocal() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    toast('Nenhum usuário logado.', 'w');
    return;
  }
  
  // Limpa pendentes e realizados do localStorage
  LS.rm('pendentes_' + uid);
  LS.rm('realizados_' + uid);
  
  // Limpa os arrays globais
  S.pendentes = [];
  S.realizados = {};
  
  // Re-renderiza a tabela
  renderPendentes();
  
  toast('Cache local limpo! Apenas dados do Firestore serão exibidos.', 's');
  
  // Opcional: recarrega os dados do Firestore
  setTimeout(() => {
    import('./realtime.js').then(({ loadFromFirestore }) => {
      loadFromFirestore();
    });
  }, 500);
}

function _validarFormCampo() {
  const dt = gv('cData'), cod = gv('cCodOp'), op = gv('cOp'), fr = gv('cFrota'), mod = gv('cModelo'), turno = gv('cTurno'), sub = gv('cSub');
  
  const getNum = (id) => parseFloat(gv(id).replace(',', '.')) || 0;
  const horas = getNum('cHoras'), haDia = getNum('cHaDia');
  const motivo = gv('cMotivo'), acao = gv('cAcao');

  const markErr = (id) => { const e = el(id); if (e) e.classList.add('campo-erro'); };

  document.querySelectorAll('.campo-erro').forEach(e => e.classList.remove('campo-erro'));

  if (!dt || !fr || !cod || horas <= 0) {
    if (!dt) markErr('cData');
    if (!fr) markErr('cFrota');
    if (!cod) markErr('cCodOp');
    if (horas <= 0) markErr('cHoras');
    toast('Preencha os campos obrigatórios!', 'w'); 
    return null;
  }

  const rendObj = getRendimento(cod);
  const atingiuHD = haDia >= S.metaPlan;
  let atingiuExtras = true;
  document.querySelectorAll('.c-extra-in').forEach(input => {
    const metaExtra = parseFloat(rendObj?.extrasPlan?.[input.dataset.id]) || 0;
    const realExtra = parseFloat(input.value.replace(',', '.')) || 0;
    if (metaExtra > 0 && realExtra < metaExtra) atingiuExtras = false;
  });

  const metaOk = atingiuHD && atingiuExtras;

  if (!metaOk) {
    if (!motivo || motivo === 'Meta Atingida!') { markErr('cMotivo'); toast('Motivo obrigatório se a meta não for atingida!', 'e'); return null; }
    if (!acao || acao === 'Meta Atingida!') { markErr('cAcao'); toast('Ação Corretiva obrigatória!', 'e'); return null; }
  }

  const formattedDate = dt.split('-').reverse().join('/');
  const extras = {};
  document.querySelectorAll('.c-extra-in').forEach(input => { extras[input.dataset.id] = parseFloat(input.value.replace(',', '.')) || 0; });

  return {
    data: formattedDate, 
    codOperacao: cod, 
    descricao: op,
    frota: fr, 
    modelo: mod, 
    turno, 
    subTurno: sub || null,
    haDia, 
    horasReal: horas,
    motivo: motivo || '--', 
    acao: acao || '--', 
    observacao: '--',
    timestamp: new Date().toISOString(),
    extras,
    uid: auth.currentUser?.uid || '',
    operador: S.session?.Nome || 'Campo'
  };
}

// ═══════════════════════════════════════════════════════════════
// SALVAR DIRETO NO FIRESTORE (sem pendentes)
// ═══════════════════════════════════════════════════════════════

export async function salvarCampo() {
  const record = _validarFormCampo();
  if (!record) return;
  
  // Verifica duplicata nos registros já salvos
  const key = `${String(record.codOperacao).trim()}|${(record.modelo || '').trim()}|${String(record.frota).trim()}`;
  const existing = S.realizados[key];
  
  if (existing) {
    const confirmSum = await customConfirm(
      "Registro Duplicado", 
      `Já existe um registro para ${record.frota} - ${record.codOperacao} hoje. Deseja somar os valores?`
    );
    if (confirmSum) {
      record.horasReal = existing.horas + record.horasReal;
      record.haDia = existing.haDia + record.haDia;
      for (const key in record.extras) {
        if (record.extras.hasOwnProperty(key)) {
          record.extras[key] = (existing.extras?.[key] || 0) + (record.extras[key] || 0);
        }
      }
      toast('Valores somados!', 's');
    } else {
      limparCampo(); 
      toast('Registro não salvo.', 'i'); 
      return;
    }
  }
  
  // Salva diretamente no Firestore
  const success = await saveCampoRecord(record);
  
  if (success) {
    clearCampoDraft();
    limparCampo();
    refreshAll();
    playSuccessSound();
  }
}

// ═══════════════════════════════════════════════════════════════
// LISTA DE PENDENTES (APENAS VISUALIZAÇÃO LOCAL)
// ═══════════════════════════════════════════════════════════════

export function renderPendentes() {
  // Filtra apenas registros que NÃO estão no Firestore
  const filtered = S.pendentes.filter(r => {
    const op = getOperacaoAgricola(r.codOperacao);
    if (!op) return false;
    
    // Verifica se este registro já existe no Firestore
    const key = `${String(r.codOperacao).trim()}|${(r.modelo || '').trim()}|${String(r.frota).trim()}`;
    const existsInFirestore = !!S.realizados[key];
    
    // Só mostra pendentes que NÃO estão no Firestore
    return !existsInFirestore && norm(op.Equipe || op.equipe) === norm(S.campoEquipe);
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
      <th>Data</th><th>Status</th>
      <th>Ação</th>
    `;
  }

  txt('pendCnt', filtered.length);

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${10 + extraCols.length}" class="empty-row"><i class="fas fa-check-circle" style="color:#4caf50"></i> Nenhum registro local - tudo sincronizado!</td><td class="empty-row" colspan="${extraCols.length + 1}"></td><td class="empty-row"></td><td class="empty-row"></td><td class="empty-row"></td><td class="empty-row"></td></tr>`;
  } else {
    tbody.innerHTML = page.map(r =>
      `<tr>
        <td data-label="Selecionar"><input type="checkbox" class="pend-check" data-id="${r.id}"></table>
        <td data-label="Cód." class="mono">${r.codOperacao}</td>
        <td data-label="Operação" class="td-l">${tc(r.descricao)}</td>
        <td data-label="Frota">${r.frota}</td>
        <td data-label="Modelo" class="td-l">${tc(r.modelo)}</td>
        <td data-label="Horas">${fmt2(r.horasReal)}</td>
        <td data-label="Há/Dia">${fmt2(r.haDia)}</td>
        ${extraCols.map(c => `<td data-label="${c.label}">${fmt2(r.extras?.[c.id] || 0)}</td>`).join('')}
        <td data-label="Data" style="font-size:.6rem">${r.data||''}</td>
        <td data-label="Status"><span class="badge bdg-pendente">Local</span></td>
        <td data-label="Ação">
          <button class="btn btn-warning btn-xs" onclick="window.HT && HT.editarPend(${r.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="window.HT && HT.delPend(${r.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`
    ).join('');
  }
  
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
  if (auth.currentUser) LS.set('pendentes_' + auth.currentUser.uid, S.pendentes);
  renderPendentes();
  toast('Dados carregados para edição. Salve para enviar ao servidor.', 's');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function pagPend(d) {
  S.pages.pend = Math.max(1, S.pages.pend + d);
  renderPendentes();
}

export async function delPend(id) {
  if (!(await customConfirm('Excluir', 'Deseja excluir este registro local?'))) return;
  S.pendentes = S.pendentes.filter(p => p.id !== id);
  if (auth.currentUser) LS.set('pendentes_' + auth.currentUser.uid, S.pendentes);
  renderPendentes();
  toast('Registro local removido.', 'w');
}

// ═══════════════════════════════════════════════════════════════
// initCampoMobile — Experiência mobile (mantido igual)
// ═══════════════════════════════════════════════════════════════
let _campoMobileReady = false;

export function initCampoMobile() {
  if (_campoMobileReady) return;
  _campoMobileReady = true;

  const campoSection = el('tab-campo');
  if (!campoSection) return;

  const FIELD_ORDER = ['cData', 'cFrota', 'cCodOp', 'cTurno', 'cSub', 'cHoras', 'cHaDia', 'cMotivo', 'cAcao'];

  function getVisibleSequence() {
    return FIELD_ORDER.filter(id => {
      const e = el(id);
      if (!e) return false;
      if (id === 'cSub') return el('cSubDiv')?.style.display !== 'none';
      return true;
    });
  }

  function focusNext(fromIdOrEl) {
    const seq = getVisibleSequence();
    const extras = Array.from(document.querySelectorAll('.c-extra-in'));

    const haDiaIdx = seq.indexOf('cHaDia');
    const full = [
      ...seq.slice(0, haDiaIdx + 1),
      ...extras,
      ...seq.slice(haDiaIdx + 1)
    ];

    let idx;
    if (typeof fromIdOrEl === 'string') {
      idx = full.indexOf(fromIdOrEl);
    } else {
      idx = full.indexOf(fromIdOrEl);
    }

    if (idx === -1 || idx >= full.length - 1) return;

    const next = full[idx + 1];

    if (typeof next === 'string') {
      const target = el(next);
      if (!target) return;
      target.focus();
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

  campoSection.addEventListener('focusin', (e) => {
    const inp = e.target;
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(inp.tagName)) return;
    campoSection.querySelectorAll('.fg.campo-focused').forEach(fg => fg.classList.remove('campo-focused'));
    const fg = inp.closest('.fg');
    if (fg) {
      fg.classList.add('campo-focused');
      setTimeout(() => {
        const rect = fg.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 100) {
          fg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, true);

  campoSection.addEventListener('focusout', (e) => {
    const fg = e.target.closest('.fg');
    if (!fg) return;
    setTimeout(() => {
      if (!fg.contains(document.activeElement)) {
        fg.classList.remove('campo-focused');
      }
    }, 150);
  }, true);

  campoSection.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = e.target;

    if (t.tagName === 'TEXTAREA') {
      if (e.shiftKey) return;
      e.preventDefault();
      focusNext(t.id);
      return;
    }

    if (t.tagName === 'INPUT') {
      e.preventDefault();
      if (t.classList.contains('c-extra-in')) {
        focusNext(t);
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

  if ('ontouchstart' in window) {
    const mobileSelects = ['cData', 'cFrota', 'cCodOp', 'cTurno', 'cSub'];
    mobileSelects.forEach(id => {
      const e = el(id);
      if (!e) return;
      e.addEventListener('change', () => {
        setTimeout(() => focusNext(id), 450);
      });
    });
  }

  _atualizarProgressoCampo();
  
  const updateAll = () => {
    _atualizarProgressoCampo();
    saveCampoDraft();
  };

  campoSection.addEventListener('change', updateAll);
  campoSection.addEventListener('input', updateAll);
}

function _atualizarProgressoCampo() {
  const indicator = el('campoProgressBar');
  if (!indicator) return;

  const campos = [
    { id: 'cData',   fn: v => !!v },
    { id: 'cFrota',  fn: v => !!v },
    { id: 'cCodOp',  fn: v => !!v },
    { id: 'cTurno',  fn: v => !!v },
    { id: 'cHoras',  fn: v => parseFloat(v) > 0 },
    { id: 'cHaDia',  fn: v => parseFloat(v) > 0 },
  ];

  const total = campos.length;
  const preenchidos = campos.filter(c => c.fn(gv(c.id))).length;
  const pct = Math.round((preenchidos / total) * 100);

  indicator.style.width = pct + '%';
  indicator.style.background = pct === 100
    ? 'var(--g600)'
    : pct >= 60
    ? '#ffa726'
    : 'var(--b800)';
}
