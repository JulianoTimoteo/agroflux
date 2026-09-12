// ═══════════════════════════════════════════════════════════════
// core/index.js — Núcleo compartilhado pelas duas interfaces
// ═══════════════════════════════════════════════════════════════
// Regras de negócio, cálculos, validações e modelos.
// NÃO conhece plataforma, DOM específico nem Android.
// Web (desktop) e Mobile (APK) importam SEMPRE daqui.
// ═══════════════════════════════════════════════════════════════

// Cálculos e regras de operação
export {
  DEFAULT_HORAS_BASE, TURNO_IDS, hasSubTurno,
  getRendimento, getRendimentoVal, getHoraBase,
  getTurnoConf, getSubTurnoConf, calcHP,
  getOperacaoAgricola, getTurnoDisplay,
  getCollectionForOperation, getUniqueTeams,
  norm, tc, tcUpper, fmt2, todayBR, escHtml,
} from '../utils.js';

// Estado e modelos
export { S, LS, APP_VERSION, PP, TEAM_ICONS } from '../state.js';

// Autorização
export * from './permissions.js';
