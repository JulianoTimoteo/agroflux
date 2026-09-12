// ═══════════════════════════════════════════════════════════════
// native/device.js — DeviceService (web + APK)
// ═══════════════════════════════════════════════════════════════

import { isNativeApp, platformName } from '../platform.js';
import { getPlugin } from './bridge.js';

export const deviceService = {
  async info() {
    if (isNativeApp()) {
      try {
        const Device = getPlugin('Device');
        if (!Device) throw new Error('plugin indisponível');
        const info = await Device.getInfo();
        const id = await Device.getId();
        return { platform: info.platform, model: info.model, os: info.osVersion, native: true, id: id?.identifier };
      } catch (e) { console.warn('[device]', e?.message); }
    }
    return { platform: platformName(), model: navigator.userAgent, os: '', native: false, id: '' };
  },
};
