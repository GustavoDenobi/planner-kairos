# Planner Kairós

Gestão de repertório e agenda para orquestras — MVP em desenvolvimento.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Auth, PostgreSQL, RLS, Storage)
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
npx supabase init   # já executado no repositório
npx supabase start
```

Copie `API URL` e `anon key` do output para `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key>
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

## Decisões da Fase 0

| Tema | Decisão |
|---|---|
| Paleta | Indigo + amber + zinc (`src/ui/theme/tokens.ts`) |
| Provedor de e-mail | Adiar para Fase 1 (Resend/Postmark) |
| Aceite de convite | Preferir RPC Postgres na Fase 1 |
| Supabase | Local via CLI; projeto cloud dev antes da Fase 1 |

## Fase atual

**Fase 0 — Fundação** concluída:

- App sobe com tema claro/escuro
- Rotas públicas e protegidas (guard stub redireciona para `/login`)
- Layout responsivo (sidebar desktop/tablet, bottom nav mobile)
- CI com typecheck, lint, test e build

**Próximo passo:** Fase 1 — IdentityAccess (login, orgs, convite, recuperação de senha).
