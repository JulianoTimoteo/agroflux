// ═══════════════════════════════════════════════════════════════
// auth.js — Autenticação (login, setup, logout, perfil, conta)
// ═══════════════════════════════════════════════════════════════
//
// ARQUITETURA SIMPLIFICADA (estilo OS CAMPO):
//
//   🔥 FIRESTORE = ÚNICA FONTE DE VERDADE
//   
//   FLUXO:
//     1. Login → carrega perfil do Firestore
//     2. Inicia listeners onSnapshot (realtime.js)
//     3. Dados chegam via listeners → atualizam S e UI
//     4. localStorage APENAS para cache de leitura (offline)
// ═══════════════════════════════════════════════════════════════

import {
  auth, db, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
  onAuthStateChanged,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from './firebase-init.js';
import {
  S, LS,
  DEFAULT_EQUIPAMENTOS, DEFAULT_RENDIMENTOS, DEFAULT_PLANO_HORAS, OPERACOES_AGRICOLAS
} from './state.js';
import {
  el, gv, sv, txt, syncUI, loading, toast, customConfirm,
  openModal, fecharModal
} from './utils.js';
import {
  loadFromFirestore, detachListeners, updateSyncTimerUI
} from './realtime.js';
import { renderTabs, activateTab } from './navigation.js';
import { refreshAll } from './refresh.js';
import { restoreCampoDraft } from './lancamento.js';

// ═══════════════════════════════════════════════════════════════
// TELAS (app, login, setup)
// ═══════════════════════════════════════════════════════════════

export function showApp() {
  el('loginPage').style.display = 'none';
  el('setupPage').style.display = 'none';
  el('app').style.display = 'block';
  loading(false);
  
  const s = S.session;
  txt('ubName', s?.Nome || 'AgroFlux');
  txt('ubRole', `${s?.Nivel || 'operador'} · Usina Pitangueiras`);
  
  renderTabs();
  refreshAll();
  
  const firstBtn = el('tabsNav')?.querySelector('.tab-btn');
  if (firstBtn) activateTab(firstBtn.dataset.tab);
  
  syncUI('ok', 'Conectado');
  
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    if (el('pwaBtn')) el('pwaBtn').style.display = 'none';
  }
}

export function showLogin() {
  el('loginPage').style.display = 'flex';
  el('setupPage').style.display = 'none';
  el('app').style.display = 'none';
  loading(false);

  const btn = el('loginBtn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
  }
}

export async function showSetup() {
  loading(true, 'Verificando sistema...');
  const snap = await getDocs(collection(db, 'usuarios'));
  if (!snap.empty) {
    toast('O sistema já possui um administrador configurado.', 'w');
    showLogin();
    return;
  }
  el('loginPage').style.display = 'none';
  el('setupPage').style.display = 'flex';
  el('app').style.display = 'none';
  loading(false);
}

// ═══════════════════════════════════════════════════════════════
// SETUP INICIAL (cria docs admin_config se não existem)
// ═══════════════════════════════════════════════════════════════

export async function setupInitialData() {
  if (S.session?.Nivel !== 'master') return;
  
  try {
    const eqRef = doc(db, 'admin_config', 'equipamentos');
    const snap = await getDoc(eqRef).catch(() => null);
    
    if (snap && !snap.exists()) {
      loading(true, 'Criando dados iniciais...');
      await Promise.all([
        setDoc(doc(db, 'admin_config', 'equipamentos'),       { items: DEFAULT_EQUIPAMENTOS,    updatedAt: new Date().toISOString() }),
        setDoc(doc(db, 'admin_config', 'rendimentos'),        { items: DEFAULT_RENDIMENTOS,     updatedAt: new Date().toISOString() }),
        setDoc(doc(db, 'admin_config', 'planoHoras'),         { items: DEFAULT_PLANO_HORAS,     updatedAt: new Date().toISOString() }),
        setDoc(doc(db, 'admin_config', 'operacoesAgricolas'), { items: OPERACOES_AGRICOLAS,     updatedAt: new Date().toISOString() }),
      ]);
      toast('Dados iniciais criados com sucesso!', 's');
    }
  } catch (e) { 
    console.warn('[FB] setupInitialData ignorado:', e); 
  } finally {
    loading(false);
  }
}

// ═══════════════════════════════════════════════════════════════
// CARREGA CACHE LOCAL (APENAS PARA LEITURA OFFLINE)
// ═══════════════════════════════════════════════════════════════

function _loadLocalCache() {
  // Apenas carrega cache para exibição offline
  // O Firestore é a fonte de verdade quando online
  S.equipamentos = LS.get('equipamentos', DEFAULT_EQUIPAMENTOS);
  S.rendimentos  = LS.get('rendimentos',  DEFAULT_RENDIMENTOS);
  S.planoHoras   = LS.get('planoHoras',   DEFAULT_PLANO_HORAS);
  S.operacoesAgricolas = LS.get('operacoesAgricolas', OPERACOES_AGRICOLAS);
  S.teamConfigs  = LS.get('teamConfigs', {});
}

// ═══════════════════════════════════════════════════════════════
// LOGIN (usuário ou e-mail)
// ═══════════════════════════════════════════════════════════════

async function loginComUsuario(loginInput, pwd) {
  let emailFinal = loginInput;
  if (!loginInput.includes('@')) {
    const q = query(collection(db, 'usuarios'), where('Login', '==', loginInput));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Usuário não encontrado.');
    emailFinal = snap.docs[0].data().Email;
  }
  await signInWithEmailAndPassword(auth, emailFinal, pwd);
}

// ═══════════════════════════════════════════════════════════════
// CARREGA PERFIL DO USUÁRIO (Firestore é a fonte)
// ═══════════════════════════════════════════════════════════════

async function loadUserProfile(firebaseUser) {
  loading(true, 'Carregando perfil...');
  
  try {
    const userRef = doc(db, 'usuarios', firebaseUser.uid);
    const snap = await getDoc(userRef);
    let profile;
    const uid = firebaseUser.uid;
    
    if (!snap.exists()) {
      // Primeiro acesso: cria perfil padrão
      profile = {
        Nome: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        Email: firebaseUser.email,
        Login: firebaseUser.email.split('@')[0],
        Nivel: 'operador',
        Ativo: true,
        Abas: ['campo', 'dashboard', 'registros'],
        Equipes: [],
        criadoEm: new Date().toISOString()
      };
      await setDoc(userRef, profile);
      toast('Perfil criado com sucesso!', 's');
    } else {
      profile = snap.data();
    }

    // Verifica se usuário está ativo
    if (profile.Ativo === false) {
      await signOut(auth);
      toast('Usuário inativo. Contate o administrador.', 'e');
      showLogin();
      return;
    }

    // Atualiza sessão
    S.session = { 
      ...profile, 
      uid: uid, 
      admin: profile.admin || profile.Nivel === 'master',
      Nivel: profile.Nivel || 'operador',
      Abas: profile.Abas || ['campo', 'dashboard', 'registros'],
      Equipes: profile.Equipes || []
    };

    // Carrega cache local (apenas para fallback offline)
    _loadLocalCache();
    
    // Restaura preferências do usuário (equipe selecionada, etc.)
    S.campoEquipe = LS.get('campoEquipe_' + uid, '');
    if (!S.campoEquipe && profile.Equipes?.length) {
      S.campoEquipe = profile.Equipes[0];
    }
    
    // Restaura rascunho do formulário
    restoreCampoDraft();
    
    // Inicia dados iniciais se for master
    await setupInitialData();
    
    // INICIA LISTENERS DO FIRESTORE (ONLINE)
    // Os listeners vão popular S.realizados, S.equipamentos, etc.
    loadFromFirestore();
    
    // Atualiza timer de sincronização
    updateSyncTimerUI();
    
    // Mostra app
    showApp();
    
  } catch (e) {
    console.error('[Auth] Erro crítico:', e);
    toast('Erro de acesso: verifique sua conexão ou permissões.', 'e');
    await signOut(auth);
    loading(false);
    showLogin();
  }
}

// ═══════════════════════════════════════════════════════════════
// ESQUECI MINHA SENHA
// ═══════════════════════════════════════════════════════════════

export async function esqueciSenha() {
  const loginInput = gv('loginLogin')?.trim();
  if (!loginInput) { 
    toast('Digite seu login ou e-mail no campo acima.', 'w'); 
    return; 
  }

  loading(true, 'Buscando usuário...');
  try {
    let emailDestino = loginInput;
    if (!loginInput.includes('@')) {
      const q = query(collection(db, 'usuarios'), where('Login', '==', loginInput));
      const snap = await getDocs(q);
      if (!snap.empty) emailDestino = snap.docs[0].data().Email;
    }
    await sendPasswordResetEmail(auth, emailDestino);
    toast('E-mail de recuperação enviado para: ' + emailDestino, 's');
  } catch (err) {
    console.error('[Reset Error]', err);
    let msg = err.code === 'auth/user-not-found' ? 'Usuário ou e-mail não encontrado.' : err.message;
    toast('Erro: ' + msg, 'e');
  } finally {
    loading(false);
  }
}

// ═══════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════

export async function logout() {
  try {
    const ok = await customConfirm('Sair', 'Deseja encerrar sua sessão?');
    if (!ok) return;

    const uid = S.session?.uid;
    
    // Salva pendentes locais (apenas cache)
    if (uid && S.pendentes.length) {
      LS.set('pendentes_' + uid, S.pendentes);
    }

    // Para os listeners antes de deslogar
    detachListeners();
    
    // Limpa sessão
    S.session = null;
    S.pendentes = [];
    S.realizados = {};
    S.equipamentos = [];
    S.rendimentos = [];
    S.planoHoras = [];
    S.operacoesAgricolas = [];
    S.teamConfigs = {};
    S.usuarios = [];
    
    await signOut(auth).catch(() => {});

    // Limpa cache de visualização
    if (uid) {
      LS.rm('realizados_' + uid);
    }

    sessionStorage.clear();
    showLogin();
  } catch (e) {
    console.error('Erro no logout:', e);
    toast('Falha ao sair: ' + e.message, 'e');
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAL "GERENCIAR CONTA"
// ═══════════════════════════════════════════════════════════════

export function abrirGerenciar() {
  const s = S.session; 
  if (!s) return;
  sv('gNome', s.Nome || ''); 
  sv('gLogin', s.Login || '');
  sv('gSenhaAntiga', ''); 
  sv('gSenhaNova1', ''); 
  sv('gSenhaNova2', '');
  openModal('mGerenciar');
}

export async function salvarGerenciar() {
  const user = auth.currentUser; 
  if (!user) return;
  
  const nome = gv('gNome')?.trim();
  const login = gv('gLogin')?.trim();
  const senhaAtual = gv('gSenhaAntiga');
  const novaSenha = gv('gSenhaNova1');
  const confirmaSenha = gv('gSenhaNova2');
  
  try {
    if (!nome || !login) throw new Error('Preencha Nome e Login');
    
    await updateDoc(doc(db, 'usuarios', user.uid), { Nome: nome, Login: login });
    
    if (novaSenha || confirmaSenha) {
      if (!senhaAtual) throw new Error('Informe a senha atual');
      if (novaSenha.length < 6) throw new Error('Senha mínima 6 caracteres');
      if (novaSenha !== confirmaSenha) throw new Error('As senhas não conferem');
      
      const cred = EmailAuthProvider.credential(user.email, senhaAtual);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, novaSenha);
    }
    
    if (S.session) { 
      S.session.Nome = nome; 
      S.session.Login = login; 
    }
    
    fecharModal('mGerenciar'); 
    showApp(); 
    toast('Atualizado com sucesso', 's');
    
  } catch (e) {
    if (e.code === 'auth/wrong-password') toast('Senha atual incorreta', 'e');
    else if (e.code === 'auth/too-many-requests') toast('Muitas tentativas, tente depois', 'e');
    else toast(e.message, 'e');
  }
}

// ═══════════════════════════════════════════════════════════════
// FORMULÁRIOS DE LOGIN E SETUP
// ═══════════════════════════════════════════════════════════════

export function initAuthForms() {
  const loginForm = el('loginForm');

  // Restaura credenciais salvas
  const savedUser = localStorage.getItem('ht_saved_user');
  const savedPass = localStorage.getItem('ht_saved_pass');
  if (savedUser && el('loginLogin')) sv('loginLogin', savedUser);
  if (savedPass && el('loginPass')) {
    try {
      sv('loginPass', atob(savedPass));
      const saveCheck = el('loginSave');
      if (saveCheck) saveCheck.checked = true;
    } catch(e) {
      console.warn('Erro ao restaurar credenciais');
    }
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const login = gv('loginLogin'), pwd = gv('loginPass');
      if (!login || !pwd) return;
      
      const btn = el('loginBtn'), errEl = el('loginErr'), iconBox = el('loginIconBox');
      btn.disabled = true; 
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
      errEl.style.display = 'none';
      if (iconBox) iconBox.classList.remove('err');

      try {
        const stayConnected = el('loginRemember')?.checked ?? true;
        await setPersistence(auth, stayConnected ? browserLocalPersistence : browserSessionPersistence);
        await loginComUsuario(login, pwd);

        const shouldSave = el('loginSave')?.checked;
        if (shouldSave) {
          localStorage.setItem('ht_saved_user', login);
          localStorage.setItem('ht_saved_pass', btoa(pwd));
        } else {
          localStorage.removeItem('ht_saved_user');
          localStorage.removeItem('ht_saved_pass');
        }
      } catch (err) {
        if (iconBox) iconBox.classList.add('err');
        const msgs = { 
          'auth/invalid-credential': 'E-mail ou senha incorretos.', 
          'auth/wrong-password': 'E-mail ou senha incorretos.', 
          'auth/user-not-found': 'Usuário não encontrado.', 
          'auth/invalid-email': 'E-mail inválido.', 
          'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.' 
        };
        errEl.textContent = msgs[err.code] || err.message || 'Erro ao entrar.';
        errEl.style.display = 'block';
        btn.disabled = false; 
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
      }
    });
  }

  // Setup (criar primeiro usuário master)
  const setupForm = el('setupForm');
  if (setupForm) {
    setupForm.addEventListener('submit', async e => {
      e.preventDefault();
      const nome = gv('setupNome'), email = gv('setupEmail'), senha = gv('setupSenha');
      if (!nome || !email || !senha || senha.length < 6) {
        toast('Preencha todos os campos (senha mín. 6 caracteres).', 'e'); 
        return;
      }
      
      const btn = el('setupBtn');
      if (btn) { 
        btn.disabled = true; 
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...'; 
      }
      
      try {
        const { createUserWithEmailAndPassword } = await import('./firebase-init.js');
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        const profile = {
          Nome: nome, 
          Email: email, 
          Login: email.split('@')[0],
          Nivel: 'master', 
          admin: true, 
          Abas: ['campo', 'dashboard', 'registros', 'admin', 'usuarios'],
          Equipes: [],
          Ativo: true, 
          criadoEm: new Date().toISOString()
        };
        await setDoc(doc(db, 'usuarios', cred.user.uid), profile);
        toast('Master criado! Entrando...', 's');
      } catch (err) {
        toast('Erro: ' + (err.message || err.code), 'e');
        if (btn) { 
          btn.disabled = false; 
          btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Master'; 
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// onAuthStateChanged (roteamento global)
// ═══════════════════════════════════════════════════════════════

export function initAuthObserver() {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      await loadUserProfile(firebaseUser);
    } else {
      S.session = null;
      detachListeners();
      showLogin();
    }
  });
}
