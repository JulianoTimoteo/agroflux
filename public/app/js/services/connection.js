// ═══════════════════════════════════════════════════════════════
// services/connection.js — Estado de conexão único (web + APK)
// ═══════════════════════════════════════════════════════════════
// Estados: ONLINE · OFFLINE · CONECTANDO · SINCRONIZANDO · ERRO
// ═══════════════════════════════════════════════════════════════

import { syncUI } from '../utils.js';
import { networkService } from '../platform/native/network.js';

export const CONN = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  CONECTANDO: 'CONECTANDO',
  SINCRONIZANDO: 'SINCRONIZANDO',
  ERRO: 'ERRO',
};

const LABEL = {
  ONLINE: 'Online', OFFLINE: 'Offline', CONECTANDO: 'Conectando...',
  SINCRONIZANDO: 'Sincronizando...', ERRO: 'Erro de conexão',
};
const DOT = { ONLINE: 'ok', OFFLINE: '', CONECTANDO: 'warn', SINCRONIZANDO: 'warn', ERRO: 'err' };

let _state = navigator.onLine ? CONN.ONLINE : CONN.OFFLINE;
const _subs = [];

export function connState() { return _state; }
export function onConnChange(fn) { _subs.push(fn); return () => { const i = _subs.indexOf(fn); if (i >= 0) _subs.splice(i, 1); }; }

export function setConnState(state) {
  _state = state;
  syncUI(DOT[state] ?? '', LABEL[state] ?? state);
  _subs.forEach(fn => { try { fn(state); } catch (e) { console.warn('[conn]', e); } });
}

export async function initConnection() {
  await networkService.init();
  networkService.onChange(({ online }) => {
    if (!online) return setConnState(CONN.OFFLINE);
    setConnState(CONN.CONECTANDO);
    setTimeout(() => { if (networkService.online) setConnState(CONN.ONLINE); }, 800);
  });
  setConnState(networkService.online ? CONN.ONLINE : CONN.OFFLINE);
}
