// ═══════════════════════════════════════════════════════════════
// native/notifications.js — NotificationService (web + APK)
// ═══════════════════════════════════════════════════════════════
// A REGRA de "quando notificar" fica no core/serviços.
// Aqui apenas ENTREGAMOS a notificação na plataforma certa.
// ═══════════════════════════════════════════════════════════════

import { isNativeApp } from '../platform.js';
import { getPlugin } from './bridge.js';

let _granted = false;

export const notificationService = {
  isAvailable() { return isNativeApp() || 'Notification' in window; },

  async requestPermission() {
    if (isNativeApp()) {
      try {
        const LocalNotifications = getPlugin('LocalNotifications');
        if (!LocalNotifications) return false;
        const res = await LocalNotifications.requestPermissions();
        _granted = res.display === 'granted';
        return _granted;
      } catch (e) { console.warn('[notify]', e?.message); return false; }
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') { _granted = true; return true; }
    if (Notification.permission === 'denied') return false;
    try {
      _granted = (await Notification.requestPermission()) === 'granted';
    } catch { _granted = false; }
    return _granted;
  },

  async notify(title, body) {
    if (!_granted) return false;
    if (isNativeApp()) {
      try {
        const LocalNotifications = getPlugin('LocalNotifications');
        if (!LocalNotifications) return false;
        await LocalNotifications.schedule({
          notifications: [{ id: Date.now() % 100000, title, body, smallIcon: 'ic_stat_icon' }],
        });
        return true;
      } catch (e) { console.warn('[notify]', e?.message); return false; }
    }
    try { new Notification(title, { body }); return true; }
    catch (e) { console.warn('[notify]', e?.message); return false; }
  },
};
