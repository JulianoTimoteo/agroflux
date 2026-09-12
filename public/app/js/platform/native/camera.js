// ═══════════════════════════════════════════════════════════════
// native/camera.js — CameraService (web + APK)
// ═══════════════════════════════════════════════════════════════
// Uma única chamada para todo o app: cameraService.takePhoto()
// Retorna { dataUrl, width, height } já comprimido, ou null.
// ═══════════════════════════════════════════════════════════════

import { isNativeApp } from '../platform.js';
import { getPlugin } from './bridge.js';

const MAX_SIDE = 900;
const QUALITY = 0.55;

function _compress(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: cv.toDataURL('image/jpeg', QUALITY), width: w, height: h });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function _pickFromInput() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(_compress(String(reader.result)));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export const cameraService = {
  isAvailable() { return true; },

  async takePhoto() {
    if (isNativeApp()) {
      try {
        const Camera = getPlugin('Camera');
        const photo = Camera && await Camera.getPhoto({
          quality: 60, allowEditing: false,
          resultType: 'dataUrl', source: 'CAMERA',
        });
        return photo?.dataUrl ? _compress(photo.dataUrl) : null;
      } catch (e) {
        console.warn('[camera] fallback web:', e?.message);
      }
    }
    return _pickFromInput();
  },
};
