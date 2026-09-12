// ═══════════════════════════════════════════════════════════════
// mobile/campo-anexos.js — Foto e localização do apontamento
// ═══════════════════════════════════════════════════════════════
// Usa a camada nativa (câmera/GPS), que funciona tanto no APK
// quanto no navegador. Os anexos entram no MESMO registro que
// já vai para o Firebase — sem base paralela.
// ═══════════════════════════════════════════════════════════════

import { el, toast } from '../utils.js';
import { cameraService, locationService } from '../platform/native/index.js';

let _foto = null;  // dataURL comprimido
let _geo  = null;  // { lat, lng, acc, at }

export function getAnexosCampo() {
  return { foto: _foto, geo: _geo };
}

export function limparAnexosCampo() {
  _foto = null; _geo = null;
  _render();
}

function _render() {
  const box = el('cAnexosPreview');
  if (!box) return;
  const parts = [];
  if (_foto) parts.push(`<figure class="anexo-foto"><img src="${_foto}" alt="Foto do apontamento"><button type="button" class="anexo-x" onclick="window.HT && HT.removerFotoCampo()" aria-label="Remover foto"><i class="fas fa-times"></i></button></figure>`);
  if (_geo) parts.push(`<span class="anexo-geo"><i class="fas fa-location-dot"></i> ${_geo.lat.toFixed(5)}, ${_geo.lng.toFixed(5)} <button type="button" class="anexo-x" onclick="window.HT && HT.removerLocalCampo()" aria-label="Remover localização"><i class="fas fa-times"></i></button></span>`);
  box.innerHTML = parts.join('');
  box.hidden = parts.length === 0;
}

export async function tirarFotoCampo() {
  const res = await cameraService.takePhoto();
  if (!res?.dataUrl) { toast('Nenhuma foto capturada.', 'w'); return; }
  _foto = res.dataUrl;
  _render();
  toast('Foto anexada ao apontamento.', 's');
}

export function removerFotoCampo() { _foto = null; _render(); }

export async function capturarLocalCampo() {
  toast('Obtendo localização...', 'i');
  const pos = await locationService.getCurrentPosition();
  if (!pos) { toast('Não foi possível obter a localização.', 'e'); return; }
  _geo = pos;
  _render();
  toast('Localização anexada.', 's');
}

export function removerLocalCampo() { _geo = null; _render(); }
