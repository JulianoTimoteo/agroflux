// ═══════════════════════════════════════════════════════════════
// platform/platform.js — Detecção de plataforma e modo de interface
// ═══════════════════════════════════════════════════════════════
// Um único núcleo, duas interfaces:
//   - 'web'    → desktop/notebook (tabelas, menu lateral, painéis)
//   - 'mobile' → toque (navegação inferior, cartões, passos)
// A escolha é automática (APK ou largura de tela) e pode ser
// trocada manualmente pelo usuário (preferência local).
// ═══════════════════════════════════════════════════════════════

import { LS } from '../state.js';

// Faixas de tela: celular → tablet → desktop.
const PHONE_MAX_WIDTH  = 767;   // celular: interface compacta de toque
const TABLET_MAX_WIDTH = 1199;  // tablet: mesma base, layout expandido

/** 'phone' | 'tablet' | 'desktop' — só pelo espaço disponível. */
export function deviceSize() {
  const w = window.innerWidth;
  if (w <= PHONE_MAX_WIDTH) return 'phone';
  if (w <= TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
}

/** true quando rodando dentro do APK (Capacitor). */
export function isNativeApp() {
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
    ? window.Capacitor.isNativePlatform()
    : window.Capacitor?.isNative);
}

export function platformName() {
  if (isNativeApp()) return window.Capacitor?.getPlatform?.() || 'android';
  return 'web';
}

export function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)')?.matches || 'ontouchstart' in window;
}

/** Modo forçado pelo usuário: 'mobile' | 'web' | null (automático). */
export function getForcedUiMode() {
  const v = LS.get('ui_mode', null);
  return v === 'mobile' || v === 'web' ? v : null;
}

export function setUiMode(mode) {
  if (mode === null) LS.rm('ui_mode');
  else LS.set('ui_mode', mode);
  applyUiMode();
}

export function currentUiMode() {
  const forced = getForcedUiMode();
  if (forced) return forced;
  const size = deviceSize();
  // No APK, tablet grande em paisagem aproveita o layout completo.
  if (isNativeApp()) return size === 'desktop' ? 'web' : 'mobile';
  if (size === 'phone' && isTouchDevice()) return 'mobile';
  if (size === 'tablet' && isTouchDevice()) return 'mobile';
  return 'web';
}

export function isMobileUi() {
  return currentUiMode() === 'mobile';
}

const _listeners = [];
export function onUiModeChange(fn) { _listeners.push(fn); }

let _lastMode = null;
export function applyUiMode() {
  const mode = currentUiMode();
  const root = document.documentElement;
  const size = deviceSize();
  root.classList.toggle('ui-mobile', mode === 'mobile');
  root.classList.toggle('ui-web', mode === 'web');
  root.classList.toggle('ui-phone', size === 'phone');
  root.classList.toggle('ui-tablet', size === 'tablet');
  root.classList.toggle('ui-desktop', size === 'desktop');
  root.classList.toggle('is-native', isNativeApp());
  if (mode !== _lastMode) {
    _lastMode = mode;
    _listeners.forEach(fn => { try { fn(mode); } catch (e) { console.warn('[platform]', e); } });
  }
  return mode;
}

export function initPlatform() {
  applyUiMode();
  window.addEventListener('resize', () => applyUiMode());
  window.addEventListener('orientationchange', () => applyUiMode());
}
