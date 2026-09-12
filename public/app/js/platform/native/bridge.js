// ═══════════════════════════════════════════════════════════════
// native/bridge.js — Acesso aos plugins do Capacitor sem bundler
// ═══════════════════════════════════════════════════════════════
// O app é servido como arquivos estáticos (sem empacotador), então
// não usamos `import '@capacitor/...'`. Dentro do APK, a ponte do
// Capacitor expõe os plugins em window.Capacitor — pegamos daí.
// No navegador retorna null e cada serviço usa o caminho web.
// ═══════════════════════════════════════════════════════════════

export function getPlugin(name) {
  const cap = window.Capacitor;
  if (!cap) return null;
  const fromRegistry = cap.Plugins?.[name];
  if (fromRegistry) return fromRegistry;
  try { return cap.registerPlugin ? cap.registerPlugin(name) : null; }
  catch { return null; }
}
