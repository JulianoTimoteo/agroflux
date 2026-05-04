# HerbTratos v4 — Pro (Modular Edition)

Migração do monolito `index.html` (2.656 linhas) para uma estrutura **modular** baseada em ES Modules, com Firebase Auth + Firestore como backend. Todo comportamento original foi preservado 1:1; apenas a organização do código foi refatorada.

---

## Estrutura de Pastas

```text
herbtratos-pro/
├── firebase.json            ← config para Firebase Hosting
├── firestore.rules          ← regras de segurança (cole no console)
├── .env.example             ← referência das chaves Firebase
├── README.md
└── public/                  ← root do hosting
    ├── index.html           ← HTML mínimo (apenas markup + imports)
    ├── manifest.json        ← PWA manifest
    ├── sw.js                ← Service Worker
    ├── logo_topo.png
    ├── icons/               ← icon-192.png, icon-512.png
    │
    ├── css/
    │   ├── global.css       ← :root vars, reset, animações
    │   ├── auth.css         ← login + setup
    │   ├── layout.css       ← user-bar, tabs, modais, .btn, .form-grid
    │   ├── lancamento.css   ← aba Campo (FAB, plan-box, badge-meta)
    │   ├── registros.css    ← aba HerbTratos (tabela, badges, eff)
    │   ├── dashboard.css    ← KPIs glass, charts
    │   ├── admin.css        ← admin-section, custom-op-list
    │   ├── usuarios.css     ← bdg-admin/master/encarregado/...
    │   └── config-colunas.css
    │
    └── js/
        ├── firebase-init.js   ← initializeApp + reexports do SDK
        ├── state.js           ← S, LS, defaults (equipamentos, rendimentos…)
        ├── utils.js           ← gv/sv/el/toast/openModal/loading/...
        ├── realtime.js        ← Firestore listeners + sync
        ├── refresh.js         ← refreshAll() (anti-ciclo)
        ├── navigation.js      ← renderTabs, activateTab, mobileNav
        ├── auth.js            ← login, setup, logout, perfil
        ├── lancamento.js      ← aba Campo + pendentes
        ├── registros.js       ← tabela HerbTratos + exports
        ├── dashboard.js       ← KPIs + charts
        ├── admin.js           ← Frotas, Rendimentos, Operações
        ├── usuarios.js        ← gerenciamento de contas (master)
        ├── config-colunas.js  ← modal "Configurar Colunas"
        └── app.js             ← entry point (window.HT + boot)
```

---

## Estrutura do Firestore

```text
fertratos (projeto)
│
├── admin_config/
│   ├── equipamentos        → { items: [...] }
│   ├── rendimentos         → { items: [...] }
│   ├── planoHoras          → { items: [...] }
│   ├── operacoesAgricolas  → { items: [...] }
│   └── team_configs        → { config: { equipe: [colunas]... } }
│
├── tratos/{docId}          → registros — Equipe Tratos
├── biomassa/{docId}        → registros — Equipe Biomassa
├── preparo/{docId}         → registros — Equipe Preparo
├── linhaamarela/{docId}    → registros — Linha Amarela
├── fertirrigacao/{docId}   → registros — Fertirrigação
│
└── usuarios/{uid}          → perfis vinculados ao Firebase Auth UID
    { Nome, Email, Login, Nivel, Ativo, Abas, criadoEm }
```

---

## Deploy

### 1. Console Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) → projeto `fertratos`
2. **Authentication** → Sign-in method → habilite **E-mail/senha**
3. **Firestore** → crie o banco (modo produção)
4. **Firestore** → Rules → cole o conteúdo de `firestore.rules`

### 2. Firebase Hosting (recomendado)

```bash
# Na raiz do repositório (mesmo diretório que firebase.json)
firebase login
firebase use fertratos
firebase deploy --only hosting
```

O conteúdo de `public/` será publicado automaticamente.

### 3. Servir localmente (sem Firebase CLI)

ES Modules exigem servir via HTTP — não funciona abrindo `index.html` direto no browser. Use qualquer servidor estático:

```bash
cd public
python3 -m http.server 5500
# abra http://localhost:5500
```

---

## Primeiro Acesso

1. Abra a URL do app
2. Clique em **"Criar conta"** na tela de login (rota de setup)
3. Preencha Nome, E-mail e Senha (mín. 6 caracteres)
4. O primeiro usuário criado recebe nível **Master** automaticamente
5. Os dados padrão (frotas, rendimentos, plano horas, operações agrícolas) são criados no Firestore automaticamente

---

## Níveis de Acesso

| Nível           | Acesso                                       |
|:----------------|:---------------------------------------------|
| `operador`      | Campo + HerbTratos + Dashboard               |
| `herbtratos`    | Campo + HerbTratos + Dashboard               |
| `administrador` | + aba Admin (frotas, rendimentos, plano)     |
| `master`        | Tudo + aba Usuários                          |

---

## Arquitetura

### `window.HT` — namespace global

O HTML continua usando `onclick="window.HT && HT.foo()"` para **fidelidade total** com o monolito original. O `app.js` popula esse namespace em runtime importando todas as funções dos módulos. Isso permite que a refatoração seja puramente estrutural — zero alterações no HTML/onclicks existentes.

### `refresh.js` — coordenador anti-ciclo

Para evitar dependências circulares entre módulos de aba (ex: `lancamento.js` quer chamar `renderHerbtratosTable` de `registros.js`, que por sua vez chama `populateCampoFrotas`...), todo refresh global passa pelo `refresh.js`. Os módulos só importam `refreshAll` desse arquivo, nunca uns dos outros.

### Offline-first

`state.js` centraliza o `LS` (helper de localStorage com prefixo `ht_`). Toda leitura tenta cache local primeiro; o Firestore valida e atualiza em background via `realtime.js`. Quando offline, os lançamentos vão para `S.pendentes` (também em LS) e são reenviados na próxima sincronização.

### Auth dupla (admin sem deslogar)

`firebase-init.js` instancia **duas** apps:
- `app` / `auth` — sessão do admin logado
- `appB` / `authB` — instância secundária usada por `usuarios.js` para `createUserWithEmailAndPassword` sem deslogar o admin atual.

---

## Notas de Migração (do GAS legacy)

- ❌ Google Apps Script → removido
- ❌ Google Sheets → removido
- ✅ Autenticação → Firebase Auth (e-mail + senha)
- ✅ Dados admin → Firestore `admin_config/*`
- ✅ Registros campo → Firestore por equipe
- ✅ Usuários → Firebase Auth + Firestore `usuarios/{uid}`
- ✅ Offline-first → localStorage como cache, Firestore como fonte de verdade
- ✅ Sincronização agendada na hora cheia

---

## Firebase Config

As chaves do Firebase Web SDK são **públicas por design** — segurança real é garantida pelas regras em `firestore.rules`.

```js
const FIREBASE_CFG = {
  apiKey:            "AIzaSyCI5oMXp9v5Y0gPBoZe4wBE7jR_QjDWku4",
  authDomain:        "fertratos.firebaseapp.com",
  projectId:         "fertratos",
  storageBucket:     "fertratos.firebasestorage.app",
  messagingSenderId: "372073605916",
  appId:             "1:372073605916:web:3078f1591caab253d4a8d9",
  measurementId:     "G-42NM186MEP"
};
```

Editar em `public/js/firebase-init.js` se quiser apontar para outro projeto.

---

## Versão

`APP_VERSION = "4.3.1"` (definida em `state.js`)
