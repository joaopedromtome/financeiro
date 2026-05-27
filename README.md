# 🎀 Meu Plano Financeiro

App de planejamento financeiro pessoal com tema kawaii/dark (Kuromi & My Melody).
Funciona 100% no navegador — pode ser hospedado em GitHub Pages, Netlify ou qualquer host estático.

🔗 Repo: <https://github.com/joaopedromtome/financeiro>

---

## ✨ O que tem dentro

- 📊 **Dashboard** com receita / despesa / saldo / orçamento
- ➕ **Lançamentos**: receitas, despesas fixas, variáveis, extras (com edição inline de pago/gasto e tag automática de estourou/no plano)
- 💳 **Cartões + parcelas inteligentes** — avançam de mês sozinhas (`3/12` → `4/12` no mês seguinte) e somem quando terminam
- 📅 **Fatura do cartão** cai como gasto no mês seguinte automaticamente
- 🎯 **Metas** com aportes mensais que descontam da renda do mês
- 📋 **Herança entre meses**: cada mês novo herda os lançamentos do mês anterior, com pago/gasto zerados
- 📈 **Análises**, **Relatórios** e **Saúde Financeira** com Kuromi/My Melody reagindo aos números
- 🔐 **Login real com confirmação de e-mail** (via Supabase, opcional)
- 💾 Modo **local** (localStorage) funciona sem nenhum setup — útil pra testar

---

## 🚀 Como hospedar no GitHub Pages

### 1. Suba o código pro repo

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/joaopedromtome/financeiro.git
git push -u origin main
```

### 2. Ative o Pages

1. Em **Settings → Pages** do repo
2. **Source:** _Deploy from a branch_
3. **Branch:** `main` / **Folder:** `/ (root)` → **Save**
4. Após ~30s, o site sobe em **https://joaopedromtome.github.io/financeiro/**

> O arquivo `.nojekyll` já está incluído pra evitar o Jekyll bagunçar o build.

---

## 🟢 Ativando contas reais com Supabase (recomendado)

Sem Supabase, o app roda em **modo local**: cada navegador é uma "ilha". Pra ter contas reais sincronizadas (login em qualquer dispositivo, e-mail de verificação chegando no inbox), siga os passos abaixo.

### 1. Crie o projeto Supabase

1. Acesse [supabase.com](https://supabase.com/) → entre com GitHub
2. **New project** → escolha sua org → nome (ex: `financeiro`) → defina uma senha do banco → região **South America (São Paulo)** → **Create new project**
3. Aguarde ~2 minutos a infra subir

### 2. Crie a tabela + política de segurança

Abra **SQL Editor** (menu lateral) → **New query** → cole e rode:

```sql
create table if not exists public.user_data (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  char text default 'kuromi',
  orcamento numeric default 0,
  store jsonb default '{}'::jsonb,
  metas jsonb default '[]'::jsonb,
  cartoes jsonb default '[]'::jsonb,
  parcelas jsonb default '[]'::jsonb,
  aportes jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table public.user_data enable row level security;

create policy "Owners only" on public.user_data
  for all
  using (auth.uid() = uid)
  with check (auth.uid() = uid);
```

### 3. Configure a autenticação

1. **Authentication → Providers → Email** → confirme que está habilitado
2. **Confirm email** ligado (o usuário só loga depois de clicar no link enviado pro e-mail)
3. **Authentication → URL Configuration:**
   - **Site URL:** `https://joaopedromtome.github.io/financeiro/`
   - **Redirect URLs:** adicione a mesma URL acima (e `http://localhost:8000` se for testar local)

### 4. Pegue as chaves

**Project Settings → API** → copie:

- **Project URL** (algo como `https://abcdefg.supabase.co`)
- **anon public** (token longo, `eyJhbGc...`)

### 5. Cole em `supabase-config.js`

```js
window.SUPABASE_CONFIG = {
  url:     "https://SEU-PROJETO.supabase.co",
  anonKey: "eyJhbGciOi..."
};
```

### 6. Commit + push

```bash
git add supabase-config.js
git commit -m "ativa supabase"
git push
```

Pronto! Agora o site:
- Cria contas reais
- Envia e-mail de verificação de verdade
- Sincroniza dados via Supabase (Postgres + JSONB)
- Cada usuário só lê/escreve os próprios dados (Row Level Security)

> ⚠️ A chave `anon` é **pública por design**. A segurança vem da **RLS policy** (que você acabou de criar acima).

---

## 🗂️ Estrutura do projeto

```
.
├── index.html           ← app principal
├── imgs.js              ← GIFs Kuromi/My Melody (base64)
├── themes.js            ← cores e textos por personagem
├── data.js              ← cálculos financeiros (calcMes, getStatus, etc)
├── supabase-config.js   ← config Supabase (placeholder até você preencher)
├── backend.js           ← camada de auth + storage (Supabase ou localStorage)
├── .nojekyll            ← desativa Jekyll no GitHub Pages
└── README.md            ← este arquivo
```

---

## 🧪 Testando local

Abre o `index.html` em qualquer navegador moderno — funciona direto, sem servidor.

Pra testar Supabase localmente, use um servidor estático qualquer:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Depois adicione `http://localhost:8000` na lista de Redirect URLs do Supabase (passo 3 acima).

---

## 🎀 Migração de dados local → cloud

Se você já usou o app no modo local e depois ativou o Supabase, na **primeira vez** que logar com a conta nova, os dados locais daquele e-mail são automaticamente migrados pra cloud e o cache local é limpo.

---

## 🖤 Personagens

- **Kuromi** — dark & baddie. Reage com `hmph` (tô rica 💸), `screaming` (estourou 😤), `peko` (sorry, saldo negativo 😭).
- **My Melody** — sweet & cute. ✨ Sparkles, +1+1 happy, yup yup, e ??? conforme a saúde financeira.

Você escolhe no registro e troca depois em **Config → Personagem & Tema**.

---

## 🛟 Troubleshooting

**"Modo Local" mesmo depois de preencher supabase-config.js**
→ Confira que `url` e `anonKey` não começam mais com `REPLACE`. Limpe o cache do navegador.

**"Invalid login credentials" no cadastro**
→ O Supabase exige senha de **6+ caracteres**.

**E-mail não chega**
→ Confira a pasta de **spam**. No Supabase, **Authentication → Logs** mostra se o envio falhou. O plano free tem limite de e-mails — pra produção, plugue um provedor SMTP em **Authentication → Email Templates → SMTP Settings**.

**Site não carrega no GitHub Pages**
→ Confira que o branch é `main` e a pasta `/ (root)`. Adicione `.nojekyll` se removeu por engano.
