# HerbTratos v4 — Firebase Edition

Migração completa de GAS/Google Sheets → **Firebase Auth + Firestore**. Este README detalha a estrutura do Firestore e as regras de segurança necessárias.

---

## Estrutura do Firestore

```text
fertratos (projeto)
│
├── admin_config/
│   ├── equipamentos    → { items: [...] }
│   ├── rendimentos     → { items: [...] }
│   ├── planoHoras      → { items: [...] }
│   └── operacoesAgricolas → { items: [...] }
│
├── tratos/{docId}      → registros de campo — Equipe Tratos
├── biomassa/{docId}    → registros de campo — Equipe Biomassa
├── preparo/{docId}     → registros de campo — Equipe Preparo
├── linhaamarela/{docId}→ registros de campo — Linha Amarela
├── fertirrigacao/{docId}→ registros de campo — Fertirrigação
│
├── usuarios/{uid}      → perfis vinculados ao Firebase Auth UID
│   { Nome, Email, Login, Nivel, Ativo, criadoEm }
│
└── dashboards/{docId}  → reservado para futuras dashboards
```

---

## Configuração e Deploy

### 1. Firebase Console

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) → projeto `fertratos`
2. **Authentication** → Sign-in method → habilite **E-mail/senha** (se ainda não o fez)
3. **Firestore** → Crie o banco (modo produção)
4. **Firestore** → Rules → cole o conteúdo de `firestore.rules`

### 2. Deploy dos arquivos

Copie os arquivos para seu hosting (Firebase Hosting, servidor ou abra `index.html` diretamente):

```bash
index.html          ← app principal
firestore.rules     ← cole no console Firestore
manifest.json
sw.js
icons/              ← crie esta pasta e adicione icon-192.png e icon-512.png
css/...
```

### 3. Primeiro Acesso

1. Abra `index.html` no browser
2. Clique em **"Criar conta"** na tela de login
3. Preencha Nome, E-mail e Senha (mínimo 6 chars)
4. O primeiro usuário criado recebe nível **Master** automaticamente
5. Os dados padrão (frotas, rendimentos, plano horas) são criados no Firestore automaticamente

### 4. Criar outros usuários

Na aba **Usuários** (visível apenas para Master):

- Clique **Novo Usuário**
- Preencha Nome, E-mail, Login, Nível e Senha
- O usuário é criado no Firebase Auth e no Firestore simultaneamente

---

## Níveis de Acesso

| Nível           | Acesso                                       |
|:----------------|:---------------------------------------------|
| `operador`      | Campo + HerbTratos + Dashboard               |
| `herbtratos`    | Campo + HerbTratos + Dashboard               |
| `administrador` | + aba Admin (frotas, rendimentos, plano)     |
| `master`        | Tudo + aba Usuários                          |

---

## Notas de Migração

- ❌ Google Apps Script → removido completamente
- ❌ Google Sheets → removido completamente
- ✅ Autenticação → Firebase Auth (e-mail + senha)
- ✅ Dados admin → Firestore `admin_config/*`
- ✅ Registros campo → Firestore por equipe (`tratos`, `biomassa`, etc.)
- ✅ Usuários → Firebase Auth + Firestore `usuarios/{uid}`
- ✅ Offline-first → localStorage como cache, Firestore como fonte de verdade
- ✅ Sincronização automática a cada 5 min quando online

---

## Firebase Config

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
