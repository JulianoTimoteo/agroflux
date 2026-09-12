// ═══════════════════════════════════════════════════════════════
// native/network.js — NetworkService (web + APK)
// ═══════════════════════════════════════════════════════════════
// Cobre Wi-Fi, 4G/5G, oscilação e reconexão. Um único ponto de
// verdade sobre "tem internet?" para as duas interfaces.
// ═══════════════════════════════════════════════════════════════

import { isNativeApp } from '../platform.js';
import { getPlugin } from './bridge.js';

const _subs = [];
let _online = navigator.onLine;
let _type = 'unknown';

function _emit() { _subs.forEach(fn => { try { fn({ online: _online, type: _type }); } catch (e) { console.warn('[network]', e); } }); }

export const networkService = {
  get online() { return _online; },
  get type() { return _type; },

  onChange(fn) { _subs.push(fn); return () => { const i = _subs.indexOf(fn); if (i >= 0) _subs.splice(i, 1); }; },

  async init() {
    window.addEventListener('online',  () => { _online = true;  _emit(); });
    window.addEventListener('offline', () => { _online = false; _emit(); });
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      _type = conn.effectiveType || 'unknown';
      conn.addEventListener?.('change', () => { _type = conn.effectiveType || 'unknown'; _emit(); });
    }
    if (isNativeApp()) {
      try {
        const Network = getPlugin('Network');
        if (!Network) return;
        const st = await Network.getStatus();
        _online = st.connected; _type = st.connectionType;
        Network.addListener('networkStatusChange', s => { _online = s.connected; _type = s.connectionType; _emit(); });
      } catch (e) { console.warn('[network]', e?.message); }
    }
    _emit();
  },
};
