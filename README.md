# AgroFlux v4.5 — Sistema de Gestão Agrícola Pro (PWA)

O **AgroFlux** é uma solução progressiva (PWA) de alta performance para apontamento e monitoramento de operações agrícolas em tempo real. Projetado para funcionar em ambientes de campo com conectividade instável, o sistema utiliza uma arquitetura modular moderna com **Firebase** e foco total na experiência do usuário mobile.

---

## 🚀 Funcionalidades Principais

### 🚜 Apontamento de Campo (Aba Campo)
- **Offline-First:** Lançamentos são salvos localmente (Pendentes) e sincronizados automaticamente quando há conexão.
- **Sistema de Rascunho (Draft):** Salva automaticamente o progresso do preenchimento para evitar perda de dados por fechamento acidental ou deslogue.
- **Experiência Mobile Nativa:**
  - Barra de progresso visual do formulário.
  - Navegação inteligente entre campos via "Enter/Next".
  - Efeito de zoom e ênfase no campo em foco.
  - Modais estilo *Bottom Sheet* para facilitar o uso com uma mão.
- **Validação de Meta:** Indicador visual instantâneo (Atingido/Não Atingido) baseado no rendimento planejado vs. realizado.

### 📊 Inteligência e Resultados
- **Dashboard Real-time:** KPIs dinâmicos e gráficos (Chart.js) com interface *Glassmorphism*.
- **Tabela Consolidada (HerbTratos):** Comparativo direto entre Planejado vs. Realizado por equipe.
- **Exportação de Dados:** Suporte para exportação em CSV (Excel) e geração de relatórios em imagem (PNG) da performance da equipe.

### ⚙️ Administração e Customização
- **Configuração de Colunas Dinâmicas:** Administradores podem criar campos extras (ex: volume m³, fardos, insumos) específicos para cada equipe (Tratos, Herbicida, Preparo, etc.).
- **Gestão de Ativos:** Controle completo de Frotas, Rendimentos e Operações Agrícolas.
- **Controle de Acesso (RBAC):** Níveis de permissão granulares (Operador, Administrador, Master) com restrição de acesso por abas e por equipes específicas.

---

## Estrutura de Pastas

```text
agroflux-main/
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
        ├── config-colunas.js  ← Configuração dinâmica de metas extras
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
... (coleções por equipe e usuários)
```

---

## 🛠 Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3 (Variáveis nativas, Grid, Flexbox), JavaScript Moderno (ES6+ Modules).
- **PWA:** Service Workers, Web App Manifest.
- **Backend:** Firebase Authentication (Login por E-mail ou Apelido), Cloud Firestore (Banco NoSQL em tempo real).
- **Gráficos:** Chart.js.
- **Utilidades:** html2canvas (Exportação de imagem), FontAwesome (Ícones).

---
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
| `administrador` | Campo + HerbTratos + Dash + Admin (Frotas/Rend) |
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
