// ═══════════════════════════════════════════════════════════════
// native/location.js — LocationService (web + APK)
// ═══════════════════════════════════════════════════════════════

import { isNativeApp } from '../platform.js';
import { getPlugin } from './bridge.js';

export const locationService = {
  isAvailable() { return isNativeApp() || !!navigator.geolocation; },

  async getCurrentPosition({ timeout = 12000 } = {}) {
    if (isNativeApp()) {
      try {
        const Geolocation = getPlugin('Geolocation');
        if (!Geolocation) throw new Error('plugin indisponível');
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout });
        return { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, at: new Date().toISOString() };
      } catch (e) {
        console.warn('[location] fallback web:', e?.message);
      }
    }
    if (!navigator.geolocation) return null;
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: new Date().toISOString() }),
        err => { console.warn('[location]', err?.message); resolve(null); },
        { enableHighAccuracy: true, timeout, maximumAge: 30000 }
      );
    });
  },
};
