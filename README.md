# AgroFlux v4.5 — Sistema de Gestão Agrícola Pro (PWA)

O **AgroFlux** é uma solução progressiva (PWA) de alta performance para apontamento e monitoramento de operações agrícolas em tempo real. Projetado para funcionar em ambientes de campo com conectividade instável, o sistema utiliza uma arquitetura modular moderna com **Firebase** e foco total na experiência do usuário mobile.

---

## 🚀 Funcionalidades Principais

### 🚜 Apontamento de Campo (Aba Campo)
- **Offline-First:** Leitura de dados via cache local quando offline; escrita exige conexão.
- **Sistema de Rascunho (Draft):** Salva automaticamente o progresso do preenchimento para evitar perda de dados por fechamento acidental ou deslogue.
- **Experiência Mobile Nativa:**
  - Barra de progresso visual do formulário.
  - Navegação inteligente entre campos via "Enter/Next".
  - Efeito de zoom e ênfase no campo em foco.
  - Modais estilo *Bottom Sheet* para facilitar o uso com uma mão.
- **Validação de Meta:** Indicador visual instantâneo (Atingido/Não Atingido) baseado no rendimento planejado vs. realizado.

### 📊 Inteligência e Resultados
- **Dashboard Real-time:** KPIs dinâmicos e gráficos (Chart.js) com interface *Glassmorphism* — atualizados automaticamente via Firestore.
- **Tabela Consolidada (HerbTratos):** Comparativo direto entre Planejado vs. Realizado por equipe.
- **Exportação de Dados:** Suporte para exportação em CSV (Excel) e geração de relatórios em imagem (PNG) da performance da equipe.

### ⚙️ Administração e Customização
- **Configuração de Colunas Dinâmicas:** Administradores podem criar campos extras (ex: volume m³, fardos, insumos) específicos para cada equipe (Tratos, Herbicida, Preparo, etc.).
- **Gestão de Ativos:** Controle completo de Frotas, Rendimentos e Operações Agrícolas.
- **Controle de Acesso (RBAC):** Níveis de permissão granulares (Operador, Administrador, Master) com restrição de acesso por abas e por equipes específicas.

---

## 🏗️ Arquitetura (OS CAMPO)

### 🔥 Firestore = Única Fonte de Verdade

Diferente de versões anteriores que utilizavam localStorage como fonte de verdade com merges complexos, o AgroFlux v4.5 adota uma arquitetura simplificada inspirada no sistema **OS CAMPO**:

| Aspecto | Implementação |
|---------|---------------|
| **Fonte de verdade** | Firestore APENAS |
| **Sincronização** | Automática via `onSnapshot` |
| **Cross-device** | Imediato (tempo real) |
| **Offline** | Leitura via cache; escrita exige conexão |
| **Pendentes** | Apenas cache visual (não é fila) |

### 📡 Sincronização em Tempo Real

Todos os dados são sincronizados automaticamente via listeners do Firestore:

- `admin_config/*` → equipamentos, rendimentos, plano de horas, operações agrícolas
- Coleções por equipe (`tratos`, `herbicida`, `preparo`, etc.) → registros do dia
- `usuarios` → lista de usuários (para níveis privilegiados)

**Não existe mais botão "Sincronizar"** — as atualizações são instantâneas entre todos os dispositivos.

### 💾 LocalStorage (Apenas Cache)

O localStorage é utilizado EXCLUSIVAMENTE para:
- Cache de leitura offline (última versão conhecida)
- Rascunho do formulário (draft)
- Preferências do usuário (equipe selecionada, aba ativa)

**Não há mais lógica de merge** entre cache e servidor. O Firestore sempre prevalece.

### 🪟 `window.HT` — Namespace Global

O HTML continua usando `onclick="window.HT && HT.foo()"` para **fidelidade total** com o monolito original. O `app.js` popula esse namespace em runtime importando todas as funções dos módulos.

### 🔄 `refresh.js` — Coordenador Anti-ciclo

Centraliza `refreshAll()` com debounce para evitar múltiplos refreshes consecutivos. Os módulos só importam `refreshAll` desse arquivo, nunca uns dos outros.

### 🔐 Auth Dupla (Admin sem Deslogar)

`firebase-init.js` instancia **duas** apps:
- `app` / `auth` — sessão do admin logado
- `appB` / `authB` — instância secundária usada por `usuarios.js` para criação de contas sem deslogar o admin atual.

---

## 📁 Estrutura de Pastas

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
        ├── utils.js           ← helpers (gv/sv/el/toast/openModal/loading/...)
        ├── realtime.js        ← Firestore listeners + escrita direta
        ├── refresh.js         ← refreshAll() com debounce
        ├── navigation.js      ← renderTabs, activateTab, mobileNav
        ├── auth.js            ← login, setup, logout, perfil
        ├── lancamento.js      ← aba Campo (formulário + salvamento direto)
        ├── registros.js       ← tabela HerbTratos + exports
        ├── dashboard.js       ← KPIs + charts
        ├── admin.js           ← Frotas, Rendimentos, Operações
        ├── config-colunas.js  ← Configuração dinâmica de metas extras
        ├── usuarios.js        ← gerenciamento de contas (master)
        └── app.js             ← entry point (window.HT + boot)


fertratos (projeto)
│
├── admin_config/
│   ├── equipamentos        → { items: [...] }
│   ├── rendimentos         → { items: [...] }
│   ├── planoHoras          → { items: [...] }
│   ├── operacoesAgricolas  → { items: [...] }
│   └── team_configs        → { config: { equipe: [colunas]... } }
│
├── tratos/                 → registros da equipe Tratos
├── herbicida/              → registros da equipe Herbicida
├── preparo/                → registros da equipe Preparo
├── biomassa/               → registros da equipe Biomassa
├── linhaamarela/           → registros da equipe Linha Amarela
├── fertirrigacao/          → registros da equipe Fertirrigação
│
└── usuarios/               → { uid: { Nome, Email, Nivel, Abas, Equipes, ... } }
        
