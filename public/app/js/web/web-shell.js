// ═══════════════════════════════════════════════════════════════
// web/web-shell.js — Interface Desktop (navegador, mouse/teclado)
// ═══════════════════════════════════════════════════════════════
// Menu lateral fixo, tabelas completas, atalhos de teclado.
// Usa o mesmo núcleo (core/) da versão mobile.
// ═══════════════════════════════════════════════════════════════

import { activateTab } from '../navigation.js';
import { podeAcessar } from '../core/permissions.js';

const SHORTCUTS = {
  '1': 'dashboard',
  '2': 'campo',
  '3': 'admin',
  '4': 'usuarios',
};

export function initWebShell() {
  document.addEventListener('keydown', e => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const tab = SHORTCUTS[e.key];
    if (tab && podeAcessar(tab)) { e.preventDefault(); activateTab(tab); }
    if (e.key.toLowerCase() === 's') { e.preventDefault(); window.HT?.salvarCampo?.(); }
  });
}
