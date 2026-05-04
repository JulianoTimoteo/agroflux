// ═══════════════════════════════════════════════════════════════
// auth.js — Autenticação (login, setup, logout, perfil, conta)
// ═══════════════════════════════════════════════════════════════

import {
  auth, db, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
  onAuthStateChanged, serverTimestamp,
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
  loadFromFirestore, detachListeners, _normalizeOps, updateSyncTimerUI
} from './realtime.js';
import { renderTabs, activateTab } from './navigation.js';
import { refreshAll } from './refresh.js';

// ── Telas: app, login, setup ──────────────────────────────────
export function showApp() {
  el('loginPage').style.display = 'none';
  el('setupPage').style.display = 'none';
  el('app').style.display = 'block';
  loading(false);
  const s = S.session;
  txt('ubName', s?.Nome || 'AgroFlux');
  txt('ubRole', `${s?.Nivel || 'operador'} · Usina Pitangueiras`);
  renderTabs(); refreshAll();
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

  // Reseta o estado do botão de login para permitir nova tentativa
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

// ── Setup inicial: cria docs admin_config se não existem ──────
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
    }
  } catch (e) { console.warn('[FB] setupInitialData ignorado'); }
}

// ── Cache local antes de qualquer leitura ─────────────────────
function _loadLocalCache() {
  S.equipamentos = LS.get('equipamentos', DEFAULT_EQUIPAMENTOS);
  S.rendimentos  = LS.get('rendimentos',  DEFAULT_RENDIMENTOS);
  S.planoHoras   = LS.get('planoHoras',   DEFAULT_PLANO_HORAS);
  S.operacoesAgricolas = LS.get('operacoesAgricolas', OPERACOES_AGRICOLAS);
  S.teamConfigs  = LS.get('teamConfigs', {});
  _normalizeOps();
}

// ── Login por usuário (apelido) ou e-mail ─────────────────────
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

// ── Carrega o perfil do usuário logado (cria se 1º acesso) ────
async function loadUserProfile(firebaseUser) {
  loading(true, 'Carregando perfil...');
  try {
    const userRef = doc(db, 'usuarios', firebaseUser.uid);
    const snap = await getDoc(userRef);
    let profile;
    if (!snap.exists()) {
      profile = {
        Nome: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        Email: firebaseUser.email,
        Nivel: 'operador',
        Ativo: false,
        Abas: ['campo', 'dashboard'],
        criadoEm: new Date().toISOString()
      };
      await setDoc(userRef, profile);
    } else {
      profile = snap.data();
    }

    if (profile.Ativo === false) {
      await signOut(auth);
      toast('Usuário inativo. Contate o administrador.', 'e');
      showLogin();
      return;
    }

    S.session = { ...profile, uid: firebaseUser.uid, admin: profile.admin || profile.Nivel === 'master', Abas: profile.Abas || [], Equipes: profile.Equipes || [] };
    await setupInitialData();
    _loadLocalCache();
    S.teamMetadata = LS.get('teamMetadata', []);
    S.realizados   = LS.get('realizados',   {});
    S.pendentes    = LS.get('pendentes',    []);
    S.usuarios     = LS.get('usuarios',     []);
    showApp();
    loadFromFirestore();
    updateSyncTimerUI();
  } catch (e) {
    console.error('[Auth] Erro crítico:', e);
    toast('Erro de acesso: verifique sua conexão ou permissões.', 'e');
    await signOut(auth);
    loading(false);
    showLogin();
  }
}

// ── Esqueci minha senha ───────────────────────────────────────
export async function esqueciSenha() {
  const loginInput = gv('loginLogin')?.trim();
  if (!loginInput) { toast('Digite seu login ou e-mail no campo acima.', 'w'); return; }

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

// ── Logout ────────────────────────────────────────────────────
export async function logout() {
  try {
    const ok = await customConfirm('Sair', 'Deseja encerrar sua sessão?');
    if (!ok) return;

    // 1. Para os listeners imediatamente
    detachListeners();
    
    // 2. Limpa o estado em memória para evitar que o Firestore tente re-sincronizar
    S.session = null;
    S.realizados = {};
    
    // 3. Desloga do Firebase
    await signOut(auth);

    // Limpeza seletiva: remove dados da sessão mas preserva credenciais (Lembrar Senha)
    const savedUser = localStorage.getItem('ht_saved_user');
    const savedPass = localStorage.getItem('ht_saved_pass');
    localStorage.clear();
    if (savedUser) localStorage.setItem('ht_saved_user', savedUser);
    if (savedPass) localStorage.setItem('ht_saved_pass', savedPass);

    sessionStorage.clear();
    showLogin();
  } catch (e) {
    console.error('Erro no logout:', e);
    toast('Falha ao sair: ' + e.message, 'e');
  }
}

// ── Modal "Gerenciar Conta" ───────────────────────────────────
export function abrirGerenciar() {
  const s = S.session; if (!s) return;
  sv('gNome', s.Nome || ''); sv('gLogin', s.Login || '');
  sv('gSenhaAntiga', ''); sv('gSenhaNova1', ''); sv('gSenhaNova2', '');
  openModal('mGerenciar');
}

export async function salvarGerenciar() {
  const user = auth.currentUser; if (!user) return;
  const nome = gv('gNome')?.trim(), login = gv('gLogin')?.trim();
  const senhaAtual = gv('gSenhaAntiga'), novaSenha = gv('gSenhaNova1'), confirmaSenha = gv('gSenhaNova2');
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
    if (S.session) { S.session.Nome = nome; S.session.Login = login; }
    fecharModal('mGerenciar'); showApp(); toast('Atualizado com sucesso', 's');
  } catch (e) {
    if (e.code === 'auth/wrong-password') toast('Senha atual incorreta', 'e');
    else if (e.code === 'auth/too-many-requests') toast('Muitas tentativas, tente depois', 'e');
    else toast(e.message, 'e');
  }
}

// ── Inicializa formulários de login e setup ───────────────────
export function initAuthForms() {
  const loginForm = el('loginForm');

  // --- LÓGICA DE LEMBRAR SENHA (AUTO-FILL) ---
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

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const login = gv('loginLogin'), pwd = gv('loginPass');
      if (!login || !pwd) return;
      const btn = el('loginBtn'), errEl = el('loginErr'), iconBox = el('loginIconBox');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
      errEl.style.display = 'none';
      if (iconBox) iconBox.classList.remove('err');

      try {
        // --- LÓGICA DE MANTER CONECTADO (PERSISTÊNCIA) ---
        const stayConnected = el('loginRemember')?.checked ?? true;
        await setPersistence(auth, stayConnected ? browserLocalPersistence : browserSessionPersistence);

        // 2. Realiza o login
        await loginComUsuario(login, pwd);

        // --- LÓGICA DE SALVAR CREDENCIAIS ---
        const shouldSave = el('loginSave')?.checked;
        if (shouldSave) {
          localStorage.setItem('ht_saved_user', login);
          localStorage.setItem('ht_saved_pass', btoa(pwd)); // Obscurece a senha em base64
        } else {
          localStorage.removeItem('ht_saved_user');
          localStorage.removeItem('ht_saved_pass');
        }
      } catch (err) {
        if (iconBox) iconBox.classList.add('err');
        const msgs = { 'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/wrong-password': 'E-mail ou senha incorretos.', 'auth/user-not-found': 'Usuário não encontrado.', 'auth/invalid-email': 'E-mail inválido.', 'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.' };
        errEl.textContent = msgs[err.code] || err.message || 'Erro ao entrar.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
      }
    });
  }

  const setupForm = el('setupForm');
  if (setupForm) {
    setupForm.addEventListener('submit', async e => {
      e.preventDefault();
      const nome = gv('setupNome'), email = gv('setupEmail'), senha = gv('setupSenha');
      if (!nome || !email || !senha || senha.length < 6) {
        toast('Preencha todos os campos (senha mín. 6 caracteres).', 'e'); return;
      }
      const btn = el('setupBtn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...'; }
      try {
        const { createUserWithEmailAndPassword } = await import('./firebase-init.js');
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        const profile = {
          Nome: nome, Email: email, Login: email.split('@')[0],
          Nivel: 'master', admin: true, Abas: [],
          Ativo: true, criadoEm: new Date().toISOString()
        };
        await setDoc(doc(db, 'usuarios', cred.user.uid), profile);
        toast('Master criado! Entrando...', 's');
      } catch (err) {
        toast('Erro: ' + (err.message || err.code), 'e');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Master'; }
      }
    });
  }
}

// ── onAuthStateChanged: roteamento global ─────────────────────
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
