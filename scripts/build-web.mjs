#!/usr/bin/env node
/**
 * build-web.mjs — Build estático do AgroFlux.
 *
 * Copia `public/app` para `dist-web/`, que é a pasta publicada no
 * GitHub Pages e também empacotada no APK (Capacitor · webDir).
 *
 * O que ele faz:
 *   1. Limpa e recria dist-web/
 *   2. Copia todos os arquivos da aplicação (caminhos já são relativos,
 *      então funciona tanto em https://user.github.io/repo/ quanto na raiz)
 *   3. Gera config.js com a configuração PÚBLICA do Firebase a partir das
 *      variáveis de ambiente (quando definidas). Nenhum segredo é gravado.
 *   4. Gera 404.html (GitHub Pages devolve esse arquivo em rotas diretas)
 *   5. Gera .nojekyll (sem isso o GitHub Pages ignora pastas com "_")
 *   6. Carimba a versão no service worker para evitar cache eterno
 */

import { cp, rm, mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'public', 'app');
const OUT = path.join(ROOT, 'dist-web');

const ENV_KEYS = [
  ['apiKey', 'VITE_FIREBASE_API_KEY'],
  ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
  ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
  ['storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET'],
  ['messagingSenderId', 'VITE_FIREBASE_MESSAGING_SENDER_ID'],
  ['appId', 'VITE_FIREBASE_APP_ID'],
  ['measurementId', 'VITE_FIREBASE_MEASUREMENT_ID'],
];

function firebaseConfigFromEnv() {
  const cfg = {};
  for (const [key, envName] of ENV_KEYS) {
    const value = process.env[envName];
    if (value) cfg[key] = value;
  }
  return Object.keys(cfg).length ? cfg : null;
}

async function main() {
  if (!existsSync(SRC)) throw new Error(`Pasta da aplicação não encontrada: ${SRC}`);

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await cp(SRC, OUT, { recursive: true });

  // ── config.js (configuração pública, sobrescrita por ambiente) ──
  const envCfg = firebaseConfigFromEnv();
  if (envCfg) {
    await writeFile(
      path.join(OUT, 'config.js'),
      `// Gerado por scripts/build-web.mjs — configuração PÚBLICA do Firebase.\n` +
        `window.AGROFLUX_FIREBASE_CFG = ${JSON.stringify(envCfg, null, 2)};\n`,
      'utf8',
    );
    console.log('[build:web] config.js gerado a partir das variáveis de ambiente');
  } else {
    console.log('[build:web] sem variáveis VITE_FIREBASE_* — mantendo a configuração padrão');
  }

  // ── Versão do build (quebra cache do SW e do WebView do APK) ──
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const swPath = path.join(OUT, 'sw.js');
  if (existsSync(swPath)) {
    const sw = await readFile(swPath, 'utf8');
    await writeFile(
      swPath,
      sw.replace(/const CACHE_NAME = '([^']+)'/, `const CACHE_NAME = '$1-${stamp}'`),
      'utf8',
    );
  }
  await writeFile(path.join(OUT, 'build-info.json'), JSON.stringify({ build: stamp }, null, 2));

  // ── GitHub Pages ──
  await copyFile(path.join(OUT, 'index.html'), path.join(OUT, '404.html'));
  await writeFile(path.join(OUT, '.nojekyll'), '');

  console.log(`[build:web] pronto → dist-web (build ${stamp})`);
}

main().catch((err) => {
  console.error('[build:web] falhou:', err);
  process.exit(1);
});
