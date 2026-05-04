// ═══════════════════════════════════════════════════════════════
// config-colunas.js — Modal "Configurar Colunas por Equipe"
// ═══════════════════════════════════════════════════════════════
// Cada equipe tem um array de colunas (system + custom) que afetam:
//   - Cabeçalho da tabela HerbTratos consolidada
//   - Colunas de "extras" no formulário de Campo
//   - Metas planejadas extras nas operações agrícolas
// Persiste em admin_config/team_configs e LS('teamConfigs').
// ═══════════════════════════════════════════════════════════════

import { db, doc, setDoc } from './firebase-init.js';
import { S, LS } from './state.js';
import { el, gv, sv, openModal, toast } from './utils.js';
import { refreshAll } from './refresh.js';

export function abrirTeamConfig() {
  openModal('mTeamConfig');
  renderTeamConfigCols();
}

export function limparTeamConfig() {
  sv('mtcNewLabel', '');
  toast('Campo limpo', 's');
}

export function renderTeamConfigCols() {
  const team = gv('mtcEquipe');
  if (!S.teamConfigs[team]) {
    S.teamConfigs[team] = [
      { id: 'hah', label: 'Há/h', type: 'system' },
      { id: 'htr', label: 'Horas Trab.', type: 'system' },
      { id: 'had', label: 'Há/Dia', type: 'system' }
    ];
  }
  const cols = S.teamConfigs[team];
  const canEdit = S.session?.Nivel === 'master' || S.session?.Nivel === 'administrador' || S.session?.Nivel === 'admin';
  el('mtcColList').innerHTML = cols.map((c, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#fff;border-radius:8px;margin-bottom:5px;border:1px solid var(--border); gap: 10px;">
      <div style="display:flex; gap: 5px;">
        <button class="btn btn-xs" onclick="window.HT && HT.moveCol('${team}', ${i}, -1)" ${i===0||!canEdit?'disabled':''}><i class="fas fa-arrow-up"></i></button>
        <button class="btn btn-xs" onclick="window.HT && HT.moveCol('${team}', ${i}, 1)" ${i===cols.length-1||!canEdit?'disabled':''}><i class="fas fa-arrow-down"></i></button>
      </div>
      <input type="text" value="${c.label}" onchange="window.HT && HT.updateColLabel('${team}', ${i}, this.value)" style="flex:1; border: none; font-weight: 600; color: var(--g800);" ${!canEdit ? 'readonly' : ''}>
      ${c.type !== 'system' && canEdit ? `<button class="btn btn-danger btn-xs" onclick="window.HT && HT.removeTeamCol(${i})"><i class="fas fa-trash"></i></button>` : '<i class="fas fa-lock" style="color:#ccc; font-size: 10px;"></i>'}
    </div>
  `).join('');
}

export async function updateColLabel(team, i, val) {
  if (!val) return;
  S.teamConfigs[team][i].label = val;
  await setDoc(doc(db, 'admin_config', 'team_configs'), { config: S.teamConfigs });
  LS.set('teamConfigs', S.teamConfigs);
  refreshAll();
}

export async function moveCol(team, i, dir) {
  const arr = S.teamConfigs[team], target = i + dir;
  if (target < 0 || target >= arr.length) return;
  [arr[i], arr[target]] = [arr[target], arr[i]];
  renderTeamConfigCols();
  await setDoc(doc(db, 'admin_config', 'team_configs'), { config: S.teamConfigs });
  LS.set('teamConfigs', S.teamConfigs);
  refreshAll();
}

export async function addTeamCol() {
  if (S.session?.Nivel !== 'master' && S.session?.Nivel !== 'administrador' && S.session?.Nivel !== 'admin') {
    toast('Apenas administradores podem gerenciar colunas.', 'e'); return;
  }
  const team = gv('mtcEquipe'), label = gv('mtcNewLabel');
  if (!label) return;
  if (!S.teamConfigs[team]) S.teamConfigs[team] = [
    { id: 'hah', label: 'Há/h', type: 'system' },
    { id: 'htr', label: 'Horas Trab.', type: 'system' },
    { id: 'had', label: 'Há/Dia', type: 'system' }
  ];
  const id = 'ext_' + Date.now();
  S.teamConfigs[team].push({ id, label });
  sv('mtcNewLabel', '');
  renderTeamConfigCols();
  await setDoc(doc(db, 'admin_config', 'team_configs'), { config: S.teamConfigs });
  LS.set('teamConfigs', S.teamConfigs);
  refreshAll();
  toast('Coluna adicionada!', 's');
}

export async function removeTeamCol(i) {
  const team = gv('mtcEquipe');
  S.teamConfigs[team].splice(i, 1);
  renderTeamConfigCols();
  await setDoc(doc(db, 'admin_config', 'team_configs'), { config: S.teamConfigs });
  LS.set('teamConfigs', S.teamConfigs);
  refreshAll();
  toast('Coluna removida!', 'w');
}
