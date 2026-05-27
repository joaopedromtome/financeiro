// ═══════════════════════════════════════════════════════════════
//  🟢 SUPABASE CONFIG
// ═══════════════════════════════════════════════════════════════
//
// Para ativar contas reais em nuvem (e-mail de verificação real,
// dados sincronizados entre dispositivos):
//
// 1. Acesse https://supabase.com  →  faça login com GitHub
// 2. "New project" → escolha org → nome (ex: "financeiro") →
//    senha do banco → região (South America - São Paulo recomendado)
//    → Create new project (leva ~2 minutos)
//
// 3. Após criado, abra "SQL Editor" (menu lateral) → "New query"
//    e cole o SQL abaixo pra criar a tabela + política:
//
//       create table if not exists public.user_data (
//         uid uuid primary key references auth.users(id) on delete cascade,
//         email text,
//         nome text,
//         char text default 'kuromi',
//         orcamento numeric default 0,
//         store jsonb default '{}'::jsonb,
//         metas jsonb default '[]'::jsonb,
//         cartoes jsonb default '[]'::jsonb,
//         parcelas jsonb default '[]'::jsonb,
//         aportes jsonb default '[]'::jsonb,
//         updated_at timestamptz default now()
//       );
//       alter table public.user_data enable row level security;
//       create policy "Owners only" on public.user_data
//         for all
//         using (auth.uid() = uid)
//         with check (auth.uid() = uid);
//
//    → Run.
//
// 4. Authentication → Providers → Email → confira que está habilitado
//    e que "Confirm email" está marcado (assim usuário só loga depois
//    de clicar no link de confirmação).
//
// 5. Authentication → URL Configuration:
//    a) Site URL: https://joaopedromtome.github.io/financeiro/
//    b) Redirect URLs: adicione a mesma URL acima
//       (e http://localhost:8000 se quiser testar local)
//
// 6. Project Settings → API → copie:
//    - "Project URL"   →  url abaixo
//    - "anon public"   →  anonKey abaixo
//
// ═══════════════════════════════════════════════════════════════
//
// 💾 SE VOCÊ NÃO PREENCHER ABAIXO, o site funciona em modo LOCAL
// (cada navegador é uma "ilha" — útil pra teste, mas não pra deploy).
//
// ═══════════════════════════════════════════════════════════════

window.SUPABASE_CONFIG = {
  url:     "https://ppagjuytugpomkjjhcpx.supabase.co",   // ex: https://xxxxx.supabase.co
  anonKey: ""       // ex: eyJhbGci... (token longo)
};
