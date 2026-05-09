// ═══════════════════════════════════════════════════════════════
// usuarios.js — Aba "Usuários" (gerenciamento, apenas master)
// ═══════════════════════════════════════════════════════════════
//
// ARQUITETURA OS CAMPO:
//   - Usa listener onSnapshot do Firestore (realtime.js)
//   - Não carrega dados manualmente via loadUsuarios()
//   - Os dados já estão em S.usuarios (atualizados em tempo real)
// ═══════════════════════════════════════════════════════════════

import {
  db, authB, doc, setDoc, updateDoc,
  createUserWithEmailAndPassword, signOut, serverTimestamp
} from './firebase-init.js';
import { S, LS } from './state.js';
import {
  el, gv, sv, txt, norm, getUniqueTeams,
  openModal, fecharModal, customConfirm, toast, renderPag
} from './utils.js';

// ═══════════════════════════════════════════════════════════════
// RENDER DA TABELA DE USUÁRIOS (master only)
// ═══════════════════════════════════════════════════════════════

export async function renderUsuarios() {
  // Verifica se o usuário tem permissão (apenas master)
  if (S.session?.Nivel !== 'master') {
    const tbody = el('usBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-row"><i class="fas fa-lock"></i> Acesso restrito a Master.</td></tr>';
    return;
  }
  
  // Verifica se há dados (se não houver, exibe mensagem)
  if (!S.usuarios || S.usuarios.length === 0) {
    const tbody = el('usBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-row"><i class="fas fa-spinner fa-spin"></i> Carregando usuários...</td></tr>';
    return;
  }
  
  const teamsData = getUniqueTeams();
  const teamMap = {}; 
  teamsData.forEach(t => teamMap[norm(t).replace(/\s+/g, '')] = t);

  const pp = 10;
  const start = (S.pages.us - 1) * pp;
  const page = S.usuarios.slice(start, start + pp);
  
  const tbody = el('usBody');
  const thead = el('usHead');
  
  if (!tbody || !thead) return;
  
  txt('usCnt', S.usuarios.length);
  
  thead.innerHTML = `<tr>
    <th class="th-base">Nome</th>
    <th class="th-base">E-mail</th>
    <th class="th-base">Criado em</th>
    <th class="th-base">Nível / Equipes</th>
    <th class="th-base">Status</th>
    <th class="th-base">Ações</th>
  </tr>`;
  
  if (page.length) {
    tbody.innerHTML = page.map(u => {
      const isSelf = S.session?.uid === u.uid;
      const ativo = u.Ativo !== false;
      
      const btnAction = ativo ?
        `<button class="btn btn-danger btn-xs" onclick="window.HT && HT.desativarUsuario('${u.uid}')"><i class="fas fa-user-slash"></i> Desativar</button>` :
        `<button class="btn btn-success btn-xs" onclick="window.HT && HT.ativarUsuario('${u.uid}')"><i class="fas fa-user-check"></i> Ativar</button>`;
      
      const editBtn = `<button class="btn btn-warning btn-xs" onclick="window.HT && HT.abrirUsuario('${u.uid}')"><i class="fas fa-edit"></i> Editar</button>`;
      
      let dataCriacao = '--';
      if (u.criadoEm) { 
        try {
          if (typeof u.criadoEm === 'string' && u.criadoEm.includes('/')) {
            dataCriacao = u.criadoEm;
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

      return `<tr class="${ativo ? '' : 'row-meta-no'}">
        <td class="td-l">${u.Nome || ''}</td>
        <td><code>${u.Email || ''}</code></td>
        <td>${dataCriacao}</td>
        <td><span class="badge bdg-${norm(u.Nivel || 'operador')}">${u.Nivel || ''}</span>${resInfo}${fieldInfo}</td>
        <td><span class="badge ${ativo ? 'bdg-ativo' : 'bdg-inativo'}">${ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td>${isSelf ? '<span style="font-size:.6rem;color:var(--muted)">🔒 você</span>' : `${editBtn} ${btnAction}`}</td>
      </tr>`;
    }).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum usuário encontrado.</td></tr>';
  }
  
  renderPag('usPag', S.usuarios.length, pp, S.pages.us, 'HT.pagUs(-1)', 'HT.pagUs(1)');
}

export function pagUs(d) { 
  S.pages.us = Math.max(1, S.pages.us + d); 
  renderUsuarios(); 
}

export function selAbas(val) {
  document.querySelectorAll('.u-ab-check').forEach(c => c.checked = val);
}

export function selTeams(val) {
  document.querySelectorAll('.u-team-check').forEach(c => c.checked = val);
}

// ═══════════════════════════════════════════════════════════════
// RENDER DOS CHECKBOXES DE ABAS NO FORMULÁRIO DE USUÁRIO
// ═══════════════════════════════════════════════════════════════

export function renderUserFormOptions(u = null) {
  const abCont = el('uAbasCheck'); 
  if (!abCont) return;
  
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
  html += appAbas.map(a => `<label style="display:flex;align-items:center;gap:5px;font-size:.7rem"><input type="checkbox" class="u-ab-check" value="${a.id}" ${uAb.includes(a.id) ? 'checked' : ''}> ${a.n}</label>`).join('');

  // SEÇÃO 2: RESULTADOS (EQUIPES NO MENU)
  html += `<div style="grid-column: 1/-1; font-weight: 800; margin-top: 15px; margin-bottom: 10px; font-size: 0.75rem; color: #2c3e50; border-bottom: 2px solid #e67e22; padding-bottom: 4px; display: flex; align-items: center; gap: 8px;">
    <i class="fas fa-chart-line"></i> EXIBIR RESULTADOS NO MENU (EQUIPES)
  </div>`;
  html += teamIds.map(a => `<label style="display:flex;align-items:center;gap:5px;font-size:.7rem; cursor:pointer;"><input type="checkbox" class="u-ab-check" value="${a.id}" ${uAb.includes(a.id) ? 'checked' : ''}> ${a.n}</label>`).join('');

  // SEÇÃO 3: EQUIPES PARA O CAMPO (DENTRO DA ABA CAMPO)
  html += `<div style="grid-column: 1/-1; font-weight: 800; margin-top: 15px; margin-bottom: 10px; font-size: 0.75rem; color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
    <div style="display: flex; align-items: center; gap: 8px;"><i class="fas fa-mobile-alt"></i> VINCULAR EQUIPES AO CAMPO (APONTAMENTO)</div>
    <div style="display: flex; gap: 5px;">
      <button type="button" class="btn btn-xs" style="font-size: 0.6rem; padding: 2px 5px;" onclick="window.HT.selTeams(true)">Todas</button>
      <button type="button" class="btn btn-xs" style="font-size: 0.6rem; padding: 2px 5px;" onclick="window.HT.selTeams(false)">Nenhuma</button>
    </div>
  </div>`;
  html += teamIds.map(a => `<label style="display:flex;align-items:center;gap:5px;font-size:.7rem; cursor:pointer;"><input type="checkbox" class="u-team-check" value="${a.id}" ${uEq.includes(a.id) ? 'checked' : ''}> ${a.n}</label>`).join('');

  abCont.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// ABRE MODAL DE NOVO/EDITAR USUÁRIO
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// SALVAR (CRIA OU ATUALIZA)
// ═══════════════════════════════════════════════════════════════

export async function salvarUsuario() {
  const nome = gv('uNome');
  const email = gv('uEmail');
  const login = gv('uLogin');
  const nivel = gv('uNivel');
  const senha = gv('uSenha');
  const abas = Array.from(document.querySelectorAll('.u-ab-check:checked')).map(c => String(c.value).trim());
  const equipes = Array.from(document.querySelectorAll('.u-team-check:checked')).map(c => String(c.value).trim());

  if (!nome || !email || !login) { 
    toast('Preencha Nome, E-mail e Login!', 'e'); 
    return; 
  }

  // Validação: Se tiver acesso ao Campo, precisa ter ao menos uma equipe
  const hasCampo = abas.includes('campo');
  if (hasCampo && equipes.length === 0) { 
    toast('Usuários com acesso ao Campo devem ter ao menos uma Equipe selecionada!', 'w'); 
    return; 
  }

  const editUid = S.editIdx.us;
  
  if (!editUid) {
    // CRIAR NOVO USUÁRIO
    if (!senha || senha.length < 6) { 
      toast('Senha mínima de 6 caracteres!', 'e'); 
      return; 
    }
    
    try {
      const cred = await createUserWithEmailAndPassword(authB, email, senha);
      await signOut(authB); // Desloga da instância secundária
      
      const profile = { 
        Nome: nome, 
        Email: email, 
        Login: login, 
        Nivel: nivel, 
        admin: (nivel === 'master' || nivel === 'admin'), 
        Abas: abas, 
        Equipes: equipes, 
        Ativo: false, 
        criadoEm: serverTimestamp() 
      };
      
      await setDoc(doc(db, 'usuarios', cred.user.uid), profile);
      
      // Atualiza o estado local (o listener do Firestore também vai pegar)
      S.usuarios.push({ ...profile, uid: cred.user.uid });
      LS.set('usuarios', S.usuarios);
      
      fecharModal('mUsuario'); 
      renderUsuarios(); 
      toast('Usuário criado (aguardando liberação)!', 's');
      
    } catch (e) {
      let msg = 'Erro ao criar usuário.';
      if (e.code === 'auth/email-already-in-use') msg = 'Este e-mail já está em uso.';
      if (e.code === 'auth/weak-password') msg = 'Senha muito fraca (mín. 6 caracteres).';
      if (e.code === 'auth/invalid-email') msg = 'Formato de e-mail inválido.';
      console.error('[Usuarios] Erro ao criar:', e);
      toast(msg, 'e');
    }
    
  } else {
    // EDITAR USUÁRIO EXISTENTE
    try {
      const updates = { 
        Nome: nome, 
        Email: email, 
        Login: login, 
        Nivel: nivel, 
        admin: (nivel === 'master' || nivel === 'admin'), 
        Abas: abas, 
        Equipes: equipes 
      };
      
      await updateDoc(doc(db, 'usuarios', editUid), updates);
      
      const idx = S.usuarios.findIndex(u => u.uid === editUid);
      if (idx >= 0) S.usuarios[idx] = { ...S.usuarios[idx], ...updates };
      LS.set('usuarios', S.usuarios);
      
      fecharModal('mUsuario'); 
      renderUsuarios(); 
      toast('Usuário atualizado!', 's');
      
    } catch (e) {
      console.error('[Usuarios] Erro ao atualizar:', e);
      toast('Erro: ' + e.message, 'e');
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// DESATIVAR / ATIVAR
// ═══════════════════════════════════════════════════════════════

export async function desativarUsuario(uid) {
  const u = S.usuarios.find(x => x.uid === uid); 
  if (!u) return;
  
  if (S.session?.uid === uid) { 
    toast('Não pode desativar a si mesmo!', 'e'); 
    return; 
  }
  
  if (!(await customConfirm('Desativar', `Desativar ${u.Nome}?`))) return;
  
  try {
    await updateDoc(doc(db, 'usuarios', uid), { Ativo: false });
    const idx = S.usuarios.findIndex(u => u.uid === uid);
    if (idx >= 0) S.usuarios[idx].Ativo = false;
    renderUsuarios(); 
    toast('Usuário desativado.', 'w');
  } catch (e) { 
    toast('Erro: ' + e.message, 'e'); 
  }
}

export async function ativarUsuario(uid) {
  const u = S.usuarios.find(x => x.uid === uid); 
  if (!u) return;
  
  if (S.session?.Nivel !== 'master') { 
    toast('Apenas Master pode ativar contas.', 'e'); 
    return; 
  }
  
  if (!(await customConfirm('Ativar', `Ativar ${u.Nome}?`))) return;
  
  try {
    await updateDoc(doc(db, 'usuarios', uid), { Ativo: true });
    const idx = S.usuarios.findIndex(u => u.uid === uid);
    if (idx >= 0) S.usuarios[idx].Ativo = true;
    renderUsuarios(); 
    toast('Usuário ativado!', 's');
  } catch (e) { 
    toast('Erro: ' + e.message, 'e'); 
  }
}
