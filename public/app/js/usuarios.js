// ═══════════════════════════════════════════════════════════════
// usuarios.js — Aba "Usuários" (gerenciamento, apenas master)
// ═══════════════════════════════════════════════════════════════
// Usa a instância secundária authB do Firebase para criar contas
// sem deslogar o admin atual.
// ═══════════════════════════════════════════════════════════════

import {
  db, authB, doc, setDoc, updateDoc, deleteDoc,
  createUserWithEmailAndPassword, signOut, serverTimestamp
} from './firebase-init.js';
import { S, LS } from './state.js';
import {
  el, gv, sv, txt, norm, escHtml, getUniqueTeams,
  openModal, fecharModal, customConfirm, toast, renderPag
} from './utils.js';
import { loadUsuarios } from './realtime.js';

// ── Render da tabela de usuários (master only) ────────────────
export async function renderUsuarios() {
  if (norm(S.session?.Nivel) !== 'master') {
    const tbody = el('usBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-row"><i class="fas fa-lock"></i> Acesso restrito a Master.</td></tr>';
    return;
  }
  if (!S.usuarios.length) await loadUsuarios();
  const teamsData = getUniqueTeams();
  const teamMap = {}; teamsData.forEach(t => teamMap[norm(t).replace(/\s+/g, '')] = t);

  const pp = 10, start = (S.pages.us - 1) * pp, page = S.usuarios.slice(start, start + pp);
  const tbody = el('usBody'), thead = el('usHead');
  if (!tbody || !thead) return;
  txt('usCnt', S.usuarios.length);
  thead.innerHTML = `<tr><th class="th-base">Nome</th><th class="th-base">E-mail</th><th class="th-base">Criado em</th><th class="th-base">Nível / Equipes</th><th class="th-base">Status</th><th class="th-base">Ações</th></tr>`;
  tbody.innerHTML = page.length ? page.map(u => {
    const isSelf = S.session?.uid === u.uid;
    const ativo = u.Ativo !== false;
    const safeName = escHtml(u.Nome || 'usuário');
    const btnAction = ativo ?
      `<button class="btn btn-danger btn-xs" title="Desativar usuário" aria-label="Desativar ${safeName}" onclick="window.HT && HT.desativarUsuario('${u.uid}')"><i class="fas fa-user-slash" aria-hidden="true"></i></button>` :
      `<button class="btn btn-success btn-xs" title="Ativar usuário" aria-label="Ativar ${safeName}" onclick="window.HT && HT.ativarUsuario('${u.uid}')"><i class="fas fa-user-check" aria-hidden="true"></i></button>`;
    const editBtn = `<button class="btn btn-warning btn-xs" title="Editar usuário" aria-label="Editar ${safeName}" onclick="window.HT && HT.abrirUsuario('${u.uid}')"><i class="fas fa-edit" aria-hidden="true"></i></button>`;
    const deleteBtn = `<button class="btn btn-danger btn-xs" title="Excluir usuário" aria-label="Excluir ${safeName}" onclick="window.HT && HT.excluirUsuario('${u.uid}')"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>`;
    
    let dataCriacao = '--';
    if (u.criadoEm) { 
      try {
        if (typeof u.criadoEm === 'string' && u.criadoEm.includes('/')) {
           dataCriacao = u.criadoEm; // Já é uma string formatada
        } else {
          const dt = u.criadoEm.toDate ? u.criadoEm.toDate() : new Date(u.criadoEm);
          if (!isNaN(dt.getTime())) dataCriacao = dt.toLocaleDateString('pt-BR');
        }
      } catch(e) {}
    }

    const resTabs = (u.Abas || []).filter(a => teamMap[a]).map(a => teamMap[a]);
    const fieldTeams = (u.Equipes || []).map(id => teamMap[id] || id);
    const resInfo = resTabs.length ? `<div style="font-size:0.55rem; color:var(--muted); margin-top:2px;"><b>Ver:</b> ${resTabs.join(', ')}</div>` : '';
    const fieldInfo = fieldTeams.length ? `<div style="font-size:0.55rem; color:var(--success); margin-top:1px;"><b>Campo:</b> ${fieldTeams.join(', ')}</div>` : '';

    return `<tr class="${ativo?'':'row-meta-no'}"><td class="td-l">${u.Nome||''}</td><td><code>${u.Email||''}</code></td><td>${dataCriacao}</td><td><span class="badge bdg-${norm(u.Nivel||'operador')}">${u.Nivel||''}</span>${resInfo}${fieldInfo}</td><td><span class="badge ${ativo?'bdg-ativo':'bdg-inativo'}">${ativo?'Ativo':'Inativo'}</span></td><td>${isSelf?'<span style="font-size:.6rem;color:var(--muted)">🔒 você</span>':`${editBtn} ${btnAction} ${deleteBtn}`}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="empty-row">Nenhum usuário.</td></tr>';
  renderPag('usPag', S.usuarios.length, pp, S.pages.us, 'HT.pagUs(-1)', 'HT.pagUs(1)');
}

export function pagUs(d) { S.pages.us = Math.max(1, S.pages.us + d); renderUsuarios(); }

export function selAbas(val) {
  document.querySelectorAll('.u-ab-check').forEach(c => c.checked = val);
}

export function selTeams(val) {
  document.querySelectorAll('.u-team-check').forEach(c => c.checked = val);
}

// ── Render dos checkboxes de Abas no formulário de usuário ────
export function renderUserFormOptions(u = null) {
  const abCont = el('uAbasCheck'); if (!abCont) return;
  const teams = getUniqueTeams();
  const teamIds = teams.map(t => ({ id: norm(t).replace(/\s+/g, ''), n: t }));
  const appAbas = [
    { id: 'campo', n: 'Lançamento (Campo)' },
    { id: 'dashboard', n: 'Dashboard' },
    { id: 'admin', n: 'Administração' },
    { id: 'usuarios', n: 'Gestão de Usuários' }
  ];
  const uAb = u?.Abas || [];
  const uEq = u?.Equipes || [];

  // SEÇÃO 1: ABAS GERAIS
  let html = `<div style="grid-column: 1/-1; font-weight: 800; margin-bottom: 10px; font-size: 0.75rem; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
    <div style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-th-large"></i> MENU SUPERIOR (ABAS PRINCIPAIS)</div>
    <div style="display: flex; gap: 5px;">
      <button type="button" class="btn btn-xs" style="font-size: 0.6rem; padding: 2px 5px;" onclick="window.HT.selAbas(true)">Todas</button>
      <button type="button" class="btn btn-xs" style="font-size: 0.6rem; padding: 2px 5px;" onclick="window.HT.selAbas(false)">Nenhuma</button>
    </div>
  </div>`;
  html += appAbas.map(a => `<label style="display:flex;align-items:center;gap:5px;font-size:.7rem"><input type="checkbox" class="u-ab-check" value="${a.id}" ${uAb.includes(a.id)?'checked':''}> ${a.n}</label>`).join('');

  // SEÇÃO 2: RESULTADOS (EQUIPES NO MENU)
  html += `<div style="grid-column: 1/-1; font-weight: 800; margin-top: 15px; margin-bottom: 10px; font-size: 0.75rem; color: #2c3e50; border-bottom: 2px solid #e67e22; padding-bottom: 4px; display: flex; align-items: center; gap: 8px;">
    <i class="fas fa-chart-line"></i> EXIBIR RESULTADOS NO MENU (EQUIPES)
  </div>`;
  html += teamIds.map(a => `<label style="display:flex;align-items:center;gap:5px;font-size:.7rem; cursor:pointer;"><input type="checkbox" class="u-ab-check" value="${a.id}" ${uAb.includes(a.id)?'checked':''}> ${a.n}</label>`).join('');

  // SEÇÃO 3: EQUIPES PARA O CAMPO (DENTRO DA ABA CAMPO)
  html += `<div style="grid-column: 1/-1; font-weight: 800; margin-top: 15px; margin-bottom: 10px; font-size: 0.75rem; color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
    <div style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-mobile-alt"></i> VINCULAR EQUIPES AO CAMPO (APONTAMENTO)</div>
    <div style="display: flex; gap: 5px;">
      <button type="button" class="btn btn-xs" style="font-size: 0.6rem; padding: 2px 5px;" onclick="window.HT.selTeams(true)">Todas</button>
      <button type="button" class="btn btn-xs" style="font-size: 0.6rem; padding: 2px 5px;" onclick="window.HT.selTeams(false)">Nenhuma</button>
    </div>
  </div>`;
  html += teamIds.map(a => `<label style="display:flex;align-items:center;gap:5px;font-size:.7rem; cursor:pointer;"><input type="checkbox" class="u-team-check" value="${a.id}" ${uEq.includes(a.id)?'checked':''}> ${a.n}</label>`).join('');

  abCont.innerHTML = html;
}

// ── Abre modal de novo/editar usuário ─────────────────────────
export function abrirUsuario(uid = null) {
  S.editIdx.us = uid;
  const u = uid ? S.usuarios.find(u => u.uid === uid) : null;
  sv('uNome', u?.Nome || '');
  sv('uEmail', u?.Email || '');
  sv('uLogin', u?.Login || '');
  sv('uNivel', u?.Nivel || 'operador');
  sv('uSenha', '');
  renderUserFormOptions(u);
  el('uSenhaGrp').style.display = uid ? 'none' : 'block';
  el('mUsuarioTitle').textContent = uid ? 'Editar Usuário' : 'Novo Usuário';
  openModal('mUsuario');
}

// ── Salvar (cria ou atualiza) ─────────────────────────────────
export async function salvarUsuario() {
  const nome = gv('uNome'), email = gv('uEmail'), login = gv('uLogin'), nivel = gv('uNivel'), senha = gv('uSenha');
  const isMaster = norm(nivel) === 'master';
  const allTeams = getUniqueTeams().map(team => norm(team).replace(/\s+/g, ''));
  const allTabs = ['campo', 'dashboard', 'admin', 'usuarios', ...allTeams];
  const abas = isMaster
    ? allTabs
    : Array.from(document.querySelectorAll('.u-ab-check:checked')).map(c => String(c.value).trim());
  const equipes = isMaster
    ? allTeams
    : Array.from(document.querySelectorAll('.u-team-check:checked')).map(c => String(c.value).trim());

  if (!nome || !email || !login) { toast('Preencha Nome, E-mail e Login!', 'e'); return; }

  // Validação: Se tiver acesso ao Campo, precisa ter ao menos uma equipe
  const hasCampo = abas.includes('campo');
  if (hasCampo && equipes.length === 0) { toast('Usuários com acesso ao Campo devem ter ao menos uma Equipe selecionada!', 'w'); return; }

  const editUid = S.editIdx.us;
  if (!editUid) {
    if (!senha || senha.length < 6) { toast('Senha mínima de 6 caracteres!', 'e'); return; }
    try {
      const cred = await createUserWithEmailAndPassword(authB, email, senha);
      await signOut(authB);
      const profile = { Nome: nome, Email: email, Login: login, Nivel: nivel, admin: (isMaster || norm(nivel) === 'admin'), Abas: abas, Equipes: equipes, Ativo: false, criadoEm: serverTimestamp() };
      await setDoc(doc(db, 'usuarios', cred.user.uid), profile);
      S.usuarios.push({ ...profile, uid: cred.user.uid });
      LS.set('usuarios', S.usuarios);
      fecharModal('mUsuario'); renderUsuarios(); toast('Usuário criado (aguardando liberação)!', 's');
    } catch (e) {
      let msg = 'Erro ao criar usuário.';
      if (e.code === 'auth/email-already-in-use') msg = 'Este e-mail já está em uso.';
      if (e.code === 'auth/weak-password') msg = 'Senha muito fraca (mín. 6 chars).';
      if (e.code === 'auth/invalid-email') msg = 'Formato de e-mail inválido.';
      toast(msg, 'e');
    }
  } else {
    try {
      const updates = { Nome: nome, Email: email, Login: login, Nivel: nivel, admin: (isMaster || norm(nivel) === 'admin'), Abas: abas, Equipes: equipes };
      await updateDoc(doc(db, 'usuarios', editUid), updates);
      const idx = S.usuarios.findIndex(u => u.uid === editUid);
      if (idx >= 0) S.usuarios[idx] = { ...S.usuarios[idx], ...updates };
      LS.set('usuarios', S.usuarios);
      fecharModal('mUsuario'); renderUsuarios(); toast('Usuário atualizado!', 's');
    } catch (e) { toast('Erro: ' + e.message, 'e'); }
  }
}

// ── Desativar / Ativar ────────────────────────────────────────
export async function desativarUsuario(uid) {
  const u = S.usuarios.find(x => x.uid === uid); if (!u) return;
  if (norm(S.session?.Nivel) !== 'master') { toast('Apenas Master pode desativar contas.', 'e'); return; }
  if (S.session?.uid === uid) { toast('Não pode desativar a si mesmo!', 'e'); return; }
  if (!(await customConfirm('Desativar', `Desativar ${u.Nome}?`))) return;
  try {
    await updateDoc(doc(db, 'usuarios', uid), { Ativo: false });
    const idx = S.usuarios.findIndex(u => u.uid === uid);
    if (idx >= 0) S.usuarios[idx].Ativo = false;
    LS.set('usuarios', S.usuarios);
    renderUsuarios(); toast('Usuário desativado.', 'w');
  } catch (e) { toast('Erro: ' + e.message, 'e'); }
}

export async function ativarUsuario(uid) {
  const u = S.usuarios.find(x => x.uid === uid); if (!u) return;
  if (norm(S.session?.Nivel) !== 'master') { toast('Apenas Master pode ativar contas.', 'e'); return; }
  if (!(await customConfirm('Ativar', `Ativar ${u.Nome}?`))) return;
  try {
    await updateDoc(doc(db, 'usuarios', uid), { Ativo: true });
    const idx = S.usuarios.findIndex(u => u.uid === uid);
    if (idx >= 0) S.usuarios[idx].Ativo = true;
    LS.set('usuarios', S.usuarios);
    renderUsuarios(); toast('Usuário ativado!', 's');
  } catch (e) { toast('Erro: ' + e.message, 'e'); }
}

// ── Excluir perfil de acesso (somente Master) ─────────────────
// A identidade do Firebase Auth permanece registrada, pois o SDK do
// navegador não pode excluir contas de terceiros com segurança. Sem o
// perfil em /usuarios, uma nova tentativa de acesso volta como inativa.
export async function excluirUsuario(uid) {
  const u = S.usuarios.find(x => x.uid === uid); if (!u) return;
  if (norm(S.session?.Nivel) !== 'master') { toast('Apenas Master pode excluir usuários.', 'e'); return; }
  if (S.session?.uid === uid) { toast('Não pode excluir a si mesmo!', 'e'); return; }
  const confirmed = await customConfirm(
    'Excluir usuário',
    `Excluir permanentemente o acesso de ${u.Nome || u.Email || 'este usuário'}? Esta ação não pode ser desfeita.`,
    'Excluir',
    'Cancelar'
  );
  if (!confirmed) return;
  try {
    await deleteDoc(doc(db, 'usuarios', uid));
    S.usuarios = S.usuarios.filter(user => user.uid !== uid);
    LS.set('usuarios', S.usuarios);
    const totalPages = Math.max(1, Math.ceil(S.usuarios.length / 10));
    S.pages.us = Math.min(S.pages.us, totalPages);
    renderUsuarios();
    toast('Usuário excluído e acesso removido.', 's');
  } catch (e) { toast('Erro ao excluir: ' + e.message, 'e'); }
}
