# Planner Kairós — desenvolvimento

Gestão de repertório e agenda para orquestras — MVP em desenvolvimento.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Auth, PostgreSQL, RLS, Storage, Edge Functions)
- Arquitetura em camadas: `domain` → `application` → `infrastructure` / `ui`

## Documentação do projeto

- [`project-overview.md`](project-overview.md) — visão do produto
- [`project-structure.md`](project-structure.md) — camadas e pastas
- [`project-models.md`](project-models.md) — entidades e invariantes
- [`implementation-plan.md`](implementation-plan.md) — fases de implementação

## Setup local

### Pré-requisitos

- Node.js 22+
- Docker (para Supabase local)

### Instalação

```bash
npm install
cp .env.example .env.local
```

### Supabase local

```bash
npx supabase start
npx supabase db reset   # migrations + seed
```

Copie `API URL` e `anon key` do output de `supabase start` para `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`SUPABASE_SERVICE_ROLE_KEY` fica só no servidor (Vercel e middleware local de Open Graph). Não use o prefixo `VITE_`.

### SMTP (recuperação de senha)

As Edge Functions `request-password-recovery` e `confirm-password-recovery` usam SMTP configurado. Para desenvolvimento local, use Mailpit/Mailhog ou outro servidor SMTP de teste:

```bash
# Exemplo com secrets locais (supabase/.env ou supabase secrets set)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@kairos.local
SMTP_SECURE=false
```

### Desenvolvimento

```bash
npm run dev
```

App disponível em `http://localhost:5173`.

### Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm run test` | Testes (Vitest) |
| `npm run deps:check` | Regras de dependência entre camadas |
| `npm run supabase:types` | Regenera tipos TypeScript do schema local |

## Seed de desenvolvimento

Após `npx supabase db reset`:

| Item | Valor |
|---|---|
| Organização | Orquestra Kairós (`slug: kairos`) |
| Formações | Orquestra, Big Band, Coral |
| Admin | `admin@kairos.local` / `kairos-admin` (também **platform admin** — painel em `/admin`) |

## Fluxo de teste manual (Fase 1)

1. Login com admin → `/orgs` → entrar em Kairós
2. Menu **Convites** → gerar link para Big Band → copiar URL
3. Abrir link em aba anônima → criar conta de músico → redireciona para `/kairos/agenda`
4. Segundo uso do mesmo link deve falhar
5. **Recuperar senha** em `/login/recuperar-senha` → OTP por e-mail (SMTP)
6. Trocar tema → recarregar → preferência persiste no perfil
7. Admin: upload/remover imagem da org no seletor `/orgs`
8. Platform admin: `/admin/organizacoes` — gerenciar orgs, usuários e planos

## Verificação após o deploy de segurança

Aplique as migrations de claim, plano e rate limit junto com o app e as Edge Functions. Deixe `20261027200000_private_org_assets_bucket.sql` por último, depois que o app novo e `SUPABASE_SERVICE_ROLE_KEY` na Vercel já estiverem no ar. Os arquivos no storage não são movidos nem apagados.

1. Partitura: quem não tem audiência não baixa o arquivo; quem tem baixa por URL assinada. A URL pública antiga (`/storage/v1/object/public/org-assets/.../pieces/...`) não abre mais.
2. Logo da organização aparece no convite, no cadastro de músico e no preview do WhatsApp (`/convite/:token`).
3. `get_musician_claim_preview` com UUID não retorna dados. O link novo é `/reivindicar/{token}`. `/musico/{uuid}` mostra link inválido. Admins precisam copiar o link de novo.
4. Um usuário de uma organização não consegue chamar `get_org_plan_usage` de outra.
5. Depois de várias tentativas de confirmar o código de senha, a recuperação fica bloqueada por alguns minutos.

## Decisões

| Tema | Decisão |
|---|---|
| Paleta | Indigo + amber + zinc (`src/ui/theme/tokens.ts`) |
| E-mail | SMTP configurado (Edge Functions) |
| Aceite de convite | RPC Postgres (`redeem_group_invite`) após Auth signup |
| Supabase | Local via CLI; migrations em `supabase/migrations/` |

## Fase atual

**Fase 1 — IdentityAccess** concluída:

- Login, logout, guard de sessão
- Seletor de organizações com imagem ou iniciais
- Convites por formação (admin) e aceite público
- Recuperação de senha via OTP próprio (SMTP)
- Tema claro/escuro persistido no perfil
- Migrations: identity + ensemble mínimo + RLS + RPCs + storage branding

**Próximo passo:** Fase 2 — Ensemble (CRUD de músicos, partes, formações).
