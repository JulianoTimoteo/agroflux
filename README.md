# AgroFlux — Gestão de Campo · Usina Pitangueiras

Aplicação de apontamento e monitoramento de produtividade agrícola em tempo real.
Uma **única base de código** atende três cenários:

| Cenário | Como roda |
| --- | --- |
| 🌐 Web | Arquivos estáticos publicados no GitHub Pages (ou Firebase Hosting) |
| 🖥️ Desktop | Navegador, layout completo com tabelas, painéis e atalhos de teclado |
| 📱 Android | Mesmo build empacotado em APK com Capacitor (celular e tablet) |

O Firebase é a **única fonte de dados** — Authentication, Firestore e Security Rules
são compartilhados por todas as plataformas. Não existe banco paralelo; o
armazenamento local serve apenas como cache e fila offline.

---

## Arquitetura

```text
                 ┌─────────────────────────────┐
                 │      CORE COMPARTILHADO     │
                 │  regras de negócio, cálculos│
                 │  Firebase, Auth, permissões │
                 │  serviços, validações       │
                 └──────────────┬──────────────┘
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
        ┌──────────────────┐        ┌──────────────────┐
        │  WEB / DESKTOP   │        │  MOBILE / APK    │
        │  tabelas, menu   │        │  cartões, barra  │
        │  lateral, teclado│        │  inferior, toque │
        └──────────────────┘        └──────────────────┘
```

```text
public/app/                 aplicação (HTML/CSS/JS, sem framework)
├── index.html
├── config.js               configuração pública por ambiente (gerada no build)
├── manifest.json  sw.js    PWA
├── css/                    global, layout, responsive, navshell, mobile…
└── js/
    ├── core/               regras de negócio e permissões (sem DOM)
    ├── services/           conexão, preferências, fila offline
    ├── platform/           detecção de plataforma (web/mobile/APK)
    │   └── native/         câmera, GPS, notificações, rede, dispositivo
    ├── web/                atalhos e comportamentos de desktop
    ├── mobile/             navegação inferior, cartões, anexos
    ├── firebase-init.js    App, Auth e Firestore
    └── …                   lancamento, admin, dashboard, registros, usuarios
scripts/build-web.mjs       build estático → dist-web/
.github/workflows/          CI, GitHub Pages e Firebase Hosting
firestore.rules             autorização (a autoridade de segurança)
capacitor.config.json       empacotamento Android
```

## Tecnologias

- HTML, CSS e JavaScript (ES Modules) — sem framework de UI
- Firebase Authentication + Cloud Firestore (SDK 10, via CDN)
- Chart.js, html2canvas, SheetJS (relatórios e exportações)
- Capacitor (empacotamento Android)
- Node.js apenas para o build e os scripts
- TanStack Start (Vite) apenas como servidor de desenvolvimento/preview

## Requisitos

```text
Node.js 18+
npm
Android Studio + Java 17  (somente para gerar o APK)
```

## Instalação

```bash
git clone https://github.com/JulianoTimoteo/agroflux
cd agroflux
npm install
cp .env.example .env      # opcional: aponta para outro projeto Firebase
npm run dev               # preview local
```

## Build web

```bash
npm run build:web         # gera dist-web/ (pronto para GitHub Pages)
npm run preview:web       # build + servidor estático local
```

O build copia a aplicação, gera `404.html` e `.nojekyll`, injeta a configuração
do Firebase a partir das variáveis de ambiente e carimba a versão no service
worker (evita que o usuário fique preso numa versão antiga).

Todos os caminhos são **relativos**, então o site funciona igual em
`https://usuario.github.io/agroflux/` e na raiz de um domínio próprio.

## Build Android (APK)

```bash
npm run android:add       # só na primeira vez: cria a pasta android/
npm run android:sync      # build web + copia para o projeto Android
npm run android:open      # abre no Android Studio
npm run android:apk       # gera o APK de debug via Gradle
```

O APK de debug sai em `android/app/build/outputs/apk/debug/app-debug.apk`.
Detalhes, permissões e assinatura de release: [`APK.md`](./APK.md).

## Firebase

A configuração do cliente Firebase é **pública por design** — quem protege os
dados são as regras em `firestore.rules`. Para usar outro projeto, preencha o
`.env` conforme o `.env.example`; o build grava esses valores em
`dist-web/config.js`.

Nunca versione service account, Firebase Admin SDK, chave privada ou token
administrativo — o `.gitignore` já bloqueia esses arquivos.

Publicar as regras:

```bash
npx firebase deploy --only firestore:rules
```

## GitHub Pages

1. Envie o projeto para o GitHub.
2. Em **Settings → Pages**, escolha **GitHub Actions** como origem.
3. (Opcional) Cadastre os segredos `VITE_FIREBASE_*` em **Settings → Secrets**.
4. Rode o workflow **Deploy GitHub Pages** em **Actions** (execução manual).

A publicação é manual de propósito: nada vai ao ar sem alguém acionar.
Alternativa: o workflow **Deploy AgroFlux → Firebase Hosting (manual)**.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build:web` | build estático em `dist-web/` |
| `npm run preview:web` | build + servidor estático |
| `npm run lint` | análise estática |
| `npm run android:sync` | build web + sincroniza o projeto Android |
| `npm run android:apk` | gera o APK de debug |

## Segurança

- Autorização no Firestore (níveis operador, líder, admin e master).
- Frontend nunca é fonte de verdade: alterar LocalStorage não concede acesso.
- Nenhum segredo real no repositório, no frontend ou no APK.
