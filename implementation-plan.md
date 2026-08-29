# Plano de implementação — Planner Kairós (MVP)

Plano de alto nível para a primeira versão do sistema. Detalhes de arquitetura, modelo e escopo estão em:

- [`project-overview.md`](project-overview.md) — visão do produto e stack
- [`project-structure.md`](project-structure.md) — camadas, pastas, casos de uso, ordem técnica
- [`project-models.md`](project-models.md) — entidades, tabelas e invariantes (fonte da verdade do domínio)
- [`project-requirements.md`](project-requirements.md) — requisitos de auth, navegação e estilos

## Objetivo do MVP

Substituir o bloco de notas do maestro por um sistema onde ele consegue **cadastrar músicos**, **catalogar repertório**, **agendar eventos com programação** e **consultar quantas vezes / quando uma obra tocou** — com multi-tenant, login por convite e acesso online a partituras.

**Critério de pronto:** maestro registra um culto de domingo, programa obras, um músico convidado acessa a org e encontra as partes relevantes ao seu assignment; na ficha da obra aparece contagem e data da última execução.

---

## Princípios de execução

1. **Fatias verticais por contexto** — cada fase entrega migration + domínio + application + infra + UI mínima, não “toda a camada de uma vez”.
2. **RLS junto com a migration** — multi-tenant e dados de contato (phone, email) desde o primeiro schema; não adiar políticas.
3. **Regras no domínio com teste** — invariantes novas nascem em `domain/**/*.test.ts` antes ou junto com o caso de uso.
4. **Dados reais cedo** — seed da Orquestra Kairós + importação de amostra do bloco de notas assim que Agenda e Repertório existirem.
5. **Fora do MVP** — comunicação (WhatsApp/e-mail), relatórios visuais, offline completo (Dexie), anotações em PDF, escalas por naipe, `partDivisionId` no assignment, pré-cadastro manual de músico sem convite.

---

## Visão das fases

| Fase | Nome | Depende de | Entrega principal |
|---|---|---|---|
| 0 | Fundação | — | App sobe, tema, rotas, CI, Supabase local |
| 1 | IdentityAccess | 0 | Login, orgs, convite, recuperação de senha, tema do usuário |
| 2 | Ensemble | 1 | Músicos (via convite), formações, partes, naipes, atribuições |
| 3 | Repertoire | 1, 2 | Catálogo de obras, upload PDF/áudio, busca |
| 4 | Agenda | 1, 3 | Eventos, tipos, programação por evento |
| 5 | Insights | 4 | Histórico na ficha da obra (texto) |
| 6 | Leitor de arquivos | 3, 2 | Visualizar/baixar PDF e áudio; filtro “minhas partes” |
| 7 | PWA shell | 0–6 estável | App instalável, precache do shell |

---

## Fase 0 — Fundação

**Objetivo:** repositório executável com estrutura de camadas e ambiente de desenvolvimento.

### Escopo

- Scaffold Vite + React + TypeScript + Tailwind (`darkMode: 'class'`)
- Árvore de pastas conforme `project-structure.md` §7 (`domain`, `application`, `infrastructure`, `ui`)
- `ui/theme` — tokens de cor, tipografia e espaçamento (paleta definida aqui)
- React Router: rotas públicas vs autenticadas; layout responsivo (sidebar desktop/tablet, bottom nav + header mobile)
- `supabase init`, projeto dev, variáveis em `.env.local`
- Composition root: único ponto que instancia cliente Supabase (`infrastructure/supabase`)
- CI mínimo: `typecheck`, `lint`, `test`
- ESLint / dependency-cruiser para regras de import (§8 de `project-structure.md`)

### Entregável

App abre, alterna tema claro/escuro, navegação vazia protegida redireciona para `/login`.

### Não inclui

Migrations de negócio, telas de auth funcionais.

---

## Fase 1 — IdentityAccess

**Objetivo:** tenant, autenticação e fluxos de entrada no sistema.

### Escopo

**Banco e RLS**

- Tabelas: `organizations`, `profiles`, `memberships`, `group_invites`, `password_recovery_codes`
- Trigger de criação de `profiles` no signup
- Policies: leitura/escrita por membership; convite público por token; OTP só via RPC/service role
- Storage: path `{organizationId}/branding/...`; campo `image_storage_key` em `organizations`

**Domínio e application**

- Entidades e regras: `Organization`, `UserProfile`, `Membership`, `GroupInvite`, `PasswordRecoveryCode`
- Casos de uso: `SignIn`, `SignOut`, `ListMyOrganizations`, `SetCurrentOrganization`, `SetThemePreference`, `SetOrganizationImage`, `RemoveOrganizationImage`, aceite de convite, solicitação/validação de recuperação de senha

**UI**

- `/login`, `/login/recuperar-senha`, `/convite/:token`, `/orgs`
- Guard: sem sessão → `/login`; autenticado sem org → seletor ou “sem acesso”
- Seletor de org com imagem ou fallback de iniciais (`project-requirements.md`)
- Troca de tema (login com `localStorage`; autenticado via perfil)

**Infra externa**

- Provedor de e-mail para OTP de recuperação (Edge Function + service role; **não** OTP do Supabase Auth)
- Aceite de convite atômico via RPC `redeem_group_invite`: cadastro/login no Auth na página de convite; RPC cria `Membership` (`member`) + `Musician` + `Assignment` (com `phone` e `birthDate` opcionais no formulário)

### Entregável

Admin cria org, gera link de convite por formação; músico cria conta e entra direto na org; recuperação de senha por e-mail funciona.

### Testes prioritários

Validade/revogação/uso único de `GroupInvite`; convite sempre cria `accessRole` = `member`.

---

## Fase 2 — Ensemble

**Objetivo:** estrutura musical da org e gestão de músicos já vinculados por convite; base para filtro de partituras e atribuições.

### Escopo

**Banco e RLS**

- Tabelas: `musicians`, `parts`, `part_divisions`, `groups`, `sections`, `section_parts`, `assignments`
- `groups.archived_at` — arquivamento suave; bloqueia convites novos
- `musicians`: contato (`phone`, `email`); **sem** `INSERT` direto — criação só via `redeem_group_invite`
- RLS de músicos: admin/owner lê e edita todos; `member` lê apenas o próprio registro
- Constraints de mesma org; unique em assignments com `COALESCE` em `section_id`/`part_id`; trigger valida `section_parts`

**Domínio e application**

- CRUD admin: parte, divisão, grupo (incl. arquivar/restaurar), seção (com composição `section_parts`), atribuição
- Músico: `ListMusicians`, `GetMusician`, `UpdateMusician`, `DeleteMusician` — **sem** `RegisterMusician` (entrada só por convite)
- Casos de uso: `CreateGroup`, `ArchiveGroup`, `RegisterPart`, `RegisterSection`, `AssignMusician`, `UpdateAssignment`, etc.

**UI**

- `/:orgSlug/musicos` — listagem (admin) e ficha com edição de contato e atribuições
- `/:orgSlug/grupos` e `/:orgSlug/grupos/:groupId` — formações, naipes, convites e composição de partes
- `/:orgSlug/partes` — catálogo de partes e divisões

**Seed de dev**

- Org Kairós, grupos (orquestra, big band, coral), partes comuns (sax alto, violino, trombone + divisões 1/2/3), naipes e `section_parts`

### Entregável

Músico entra pela Fase 1 (convite + assignment inicial); admin gerencia formações, naipes, partes e atribuições adicionais na ficha do músico.

### Não inclui

Pré-cadastro manual de músico sem convite, escalas, disponibilidade, cadeira (`partDivisionId`) no assignment.

---

## Fase 3 — Repertoire

**Objetivo:** catálogo online do repertório com arquivos.

### Escopo

**Banco e RLS**

- Tabelas: `piece_categories`, `piece_themes`, `pieces`, `piece_theme_links`, `piece_files`, `piece_file_part_links`
- Soft-delete em `pieces` (`deleted_at`)
- Bucket privado: `{organizationId}/pieces/{pieceId}/{fileId}-{filename}`
- Seed por org: categorias (Instrumental, HCA, Coral, Solo) e temas (Natal, Ceia, etc.)

**Domínio e application**

- `CatalogPiece`, `UpdatePiece`, `AttachPieceFile`, `SearchPieces`, `GetPiece`
- Links N:N obra↔tema e arquivo↔parte/divisão

**UI**

- `/:orgSlug/repertorio` — busca e filtros por categoria/tema
- `/:orgSlug/repertorio/:pieceId` — ficha da obra, upload e gestão de arquivos

### Entregável

Maestro cataloga obra com PDF por parte e áudio; músico autenticado busca e abre ficha.

### Não inclui

Leitor embutido (Fase 6); versionamento de arquivos.

---

## Fase 4 — Agenda

**Objetivo:** agenda de ensaios, cultos e eventos com repertório selecionado.

### Escopo

**Banco e RLS**

- Tabelas: `event_types`, `events`, `program_items`
- Seed por org: ensaios, cultos, ceia, aula, congresso (`project-models.md` §4.1)
- Índice em `program_items(piece_id)` para Insights

**Domínio e application**

- `ScheduleEvent`, `UpdateEvent`, `SetEventProgram`, `ListEventsInRange`
- Evento sem programação é válido; obra soft-deleted não entra em programação nova

**UI**

- `/:orgSlug/agenda` — calendário ou lista por intervalo
- `/:orgSlug/eventos/:eventId` — detalhe, tipo, data, programação ordenada

### Entregável

Maestro registra culto de domingo e associa obras — substitui o bloco de notas.

---

## Fase 5 — Insights (despriorizada)

**Objetivo:** responder “quantas vezes tocou?” e “quando foi a última vez?”.

### Escopo

- Caso de uso `GetPiecePerformanceHistory` — leitura sobre `program_items` + `events` + `pieces`
- Projeção: `playCount`, `lastPerformedAt`; filtros opcionais por `EventKind` e intervalo
- UI: bloco de texto na ficha da obra (e opcionalmente no evento)

### Entregável

Na ficha da obra, maestro vê contagem e data da última execução.

### Não inclui

Gráficos, exportação, relatórios por naipe ou trimestre.

---

## Fase 6 — Leitor de arquivos

**Objetivo:** consulta prática de partituras e áudios no browser.

### Escopo

- Visualização PDF (pdf.js) e player de áudio
- Download via signed URL
- Filtro “PDFs da minha parte”: links com `partId` do assignment do usuário + partitura geral (sem links)
- Responsivo para tablet (uso em ensaio)

### Entregável

Músico abre a obra e vê/baixa a partitura da sua parte sem depender do maestro.

### Não inclui

Anotações, modo performance, cache offline de arquivos.

---

## Fase 7 — PWA shell

**Objetivo:** app instalável com shell em cache; preparar terreno para offline futuro.

### Escopo

- `public/manifest.webmanifest`
- Service worker mínimo (Workbox): precache de assets do app shell
- Pasta `infrastructure/pwa/` com esqueleto para Dexie (sem sync no MVP)

### Entregável

Instalação no dispositivo; navegação básica funciona offline (shell apenas).

### Depois do MVP

Dexie espelhando entidades do domínio; cache de `PieceFile` para leitura offline.

---

## Dependências entre fases

```
Fase 0
  └── Fase 1 (IdentityAccess)
        ├── Fase 2 (Ensemble) ──┐
        │                         ├── Fase 3 (Repertoire)
        │                         │     └── Fase 4 (Agenda)
        │                         │           └── Fase 5 (Insights)
        │                         └────────────── Fase 6 (Leitor)
        └── Fase 7 (PWA) — após fluxo online estável (idealmente após Fase 5 ou 6)
```

Fases 2 e 3 podem avançar em paralelo após a Fase 1, desde que Ensemble tenha o mínimo (grupos + partes) antes dos links de arquivo.

---

## Decisões a fechar na Fase 0

| Tema | Opções / nota |
|---|---|
| Provedor de e-mail | Resend, Postmark, etc. — necessário na Fase 1 |
| Paleta e tokens | Definir em `ui/theme` antes de telas de produto |
| Supabase | Projeto dev + prod; secrets só em ambiente |
| Aceite de convite | RPC Postgres vs Edge Function — escolher um e documentar |
| Biblioteca de calendário | Fase 4 — escolher na implementação (lista simples aceita no MVP) |

---

## Milestones de validação com o maestro

1. **Após Fase 1** — convite de um músico real; login, entrada na org e assignment inicial no grupo do convite.
2. **Após Fase 2** — admin configura naipes/partes e atribuições adicionais na ficha do músico.
3. **Após Fase 3** — catalogar 5–10 obras com PDFs reais.
4. **Após Fase 4** — registrar 2–3 cultos do bloco de notas com programação.
5. **Após Fase 5** — conferir contagens contra o histórico manual.
6. **Após Fase 6** — músico acessa partitura da sua parte no tablet/celular.

---

## Referência rápida: rotas do MVP

```
/login
/login/recuperar-senha
/convite/:token
/orgs
/:orgSlug/agenda
/:orgSlug/repertorio
/:orgSlug/repertorio/:pieceId
/:orgSlug/eventos/:eventId
/:orgSlug/musicos
/:orgSlug/musicos/:musicianId
/:orgSlug/grupos
/:orgSlug/grupos/:groupId
/:orgSlug/partes
/admin/organizacoes
/admin/organizacoes/:orgId
/admin/usuarios
/admin/usuarios/:userId
/admin/planos
/admin/planos/:planId
```

---

## Fase 8 — Platform Admin

**Objetivo:** administração inter-organizacional da plataforma (D9), catálogo de planos com limites enforced, gestão de usuários.

### Entregável

- `platform_admins` + bypass RLS via `is_platform_admin()`
- Painel `/admin` (Organizações, Usuários, Planos)
- Platform admin vê todas as orgs em `/orgs` e entra com privilégios totais
- Planos com limites de grupos, músicos, peças e storage; triggers `assert_org_plan_limit`
- Edge Functions: `platform-set-user-password`, `platform-delete-user`

### Fora de escopo

Stripe, suspensão de org, impersonação, self-service de criação de org por clientes.

---

## Próximo passo

Iniciar **Fase 3 (Repertoire)**: migrations de `piece_categories`, `piece_themes`, `pieces`, links e storage de arquivos — ver `project-models.md` §3.
