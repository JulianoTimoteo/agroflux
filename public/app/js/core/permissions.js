// ═══════════════════════════════════════════════════════════════
// core/permissions.js — Autorização compartilhada (web + APK)
// ═══════════════════════════════════════════════════════════════
// A interface NUNCA é a autoridade: as Firestore Security Rules
// continuam decidindo o que cada usuário pode gravar/ler. Aqui
// apenas escondemos o que o usuário não pode usar.
// ═══════════════════════════════════════════════════════════════

import { S } from '../state.js';
import { norm } from '../utils.js';

export function nivelAtual(session = S.session) {
  return norm(session?.Nivel || 'operador');
}

export function isMaster(session = S.session) {
  return nivelAtual(session) === 'master';
}

export function abasPermitidas(session = S.session) {
  return Array.isArray(session?.Abas) ? session.Abas : [];
}

/** Pode abrir esta aba/tela? Vale igual no desktop e no celular. */
export function podeAcessar(tabId, session = S.session) {
  if (!session) return false;
  if (isMaster(session)) return true;
  return abasPermitidas(session).includes(tabId);
}

export function equipesDoUsuario(session = S.session) {
  const eq = session?.Equipes ?? session?.Equipe;
  if (Array.isArray(eq)) return eq;
  return eq ? [eq] : [];
}
