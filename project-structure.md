# Estrutura do projeto — Planner Kairós

Este documento é o guia de implementação do MVP. Ele define camadas, pastas, modelo de domínio e o que entra agora versus o que só é preparado para o futuro. A stack está em `project-overview.md` (React, TypeScript, Vite, Tailwind, PWA, Supabase, Vercel).

O código usa nomes em inglês. Os termos de negócio neste documento ficam em português.

---

## 1. Princípios

1. **Domínio e UI nascem separados.** Regras de orquestra, agenda e repertório não vivem em componentes React. Telas não conhecem Supabase, Dexie nem RLS.
2. **O domínio não depende de framework.** Entidades, regras e casos de uso são TypeScript puro. Isso permite testar sem renderizar tela e trocar UI ou infra sem reescrever o negócio.
3. **Multi-tenant desde o primeiro schema.** Nenhuma tabela de negócio assume “a Orquestra Kairós”. Toda entidade de tenant tem `organizationId`. A organização corrente é contexto de aplicação, não constante.
4. **MVP estreito, modelo largo o suficiente.** A UI do MVP cobre o fluxo do maestro (cadastrar, agendar, consultar histórico). O modelo já registra o que relatórios, grupos e offline vão precisar depois.
5. **Fonte da verdade no servidor.** PostgreSQL + RLS no Supabase. Cache local (Dexie) é cópia, não autoridade.
6. **Dependências apontam para dentro.** UI e infraestrutura dependem do domínio/aplicação. O contrário é proibido.

---

## 2. Escopo: MVP × depois

O maestro hoje opera com um bloco de notas de cultos. O MVP existe para substituir isso com cadastro, agenda e histórico consultável — sem WhatsApp, sem dashboard visual e sem offline completo.

| Capacidade | MVP | Depois |
|---|---|---|
| Login, perfil, troca de organização | Sim | — |
| Convite de criação de conta (link por formação, validade, revogação) | Sim | Convite com papel de acesso no link, convite nominativo por e-mail |
| Recuperação de senha via OTP próprio (e-mail do sistema) | Sim | — |
| Imagem de identificação por organização (seletor de orgs) | Sim | Branding ampliado (cabeçalho, PWA por org) |
| Tema claro / escuro (escolha do usuário) | Sim | Tema por organização, alto contraste, seguir o SO |
| Cadastro de músicos (nome, nascimento, escolaridade, CPF) | Sim | Aniversariantes, dados extras, LGPD avançada |
| Partes, naipes, grupos e papéis (integrante, professor, chefe de naipe) | Modelo + cadastro simples | Escalas por naipe, disponibilidade, turmas |
| Catálogo de repertório (título, categoria, temas, arquivos PDF/áudio) | Sim | Versionamento, arranjos, metadados ricos |
| Busca de obras para músicos | Sim (online) | Filtro por parte do músico, busca avançada |
| Agenda de ensaios, aulas, cultos e eventos especiais | Sim | Recorrência sofisticada, conflitos, presença |
| Repertório selecionado por evento | Sim | Ordem, tonalidade, observações de arranjo |
| “Quantas vezes / última vez que tocou” | Consulta simples na obra e no evento | Relatórios visuais, trimestre, comparativos |
| Leitor de PDF/áudio online | Visualizar e baixar | Anotações, sincronização de partitura |
| PWA / offline | App instalável + cache do shell | Dexie + arquivos offline por obra |
| Comunicação (WhatsApp, e-mail) | Não | Fora do núcleo; canal à parte |
| Relatórios mensais/anuais de escala | Dados já existem nos eventos | Exportação / PDF |

Regra prática: se um dado é necessário para um relatório futuro (execução de obra em culto, tipo de evento, data), ele já entra no modelo de escrita do MVP, mesmo sem tela de relatório.

---

## 3. Arquitetura em camadas

```
┌─────────────────────────────────────────────┐
│                    UI                       │
│  rotas, páginas, componentes, Tailwind      │
│  (React — sem cliente Supabase direto)      │
└────────────────────┬────────────────────────┘
                     │ chama
┌────────────────────▼────────────────────────┐
│               APPLICATION                   │
│  casos de uso, contexto de tenant, ports    │
└────────────────────┬────────────────────────┘
                     │ usa
┌────────────────────▼──────────┐    ┌────────▼─────────────┐
│            DOMAIN             │    │   INFRASTRUCTURE     │
│  entidades, VOs, regras       │◄───│  Supabase, Dexie,    │
│  (zero React, zero HTTP)      │    │  Workbox, storage    │
└───────────────────────────────┘    └──────────────────────┘
```

| Camada | Responsabilidade | Pode importar |
|---|---|---|
| `domain` | O que a orquestra *é*: obras, eventos, músicos, regras | Nada de `ui` / `application` / `infrastructure` |
| `application` | O que o sistema *faz*: casos de uso e portas (interfaces de repositório) | `domain` |
| `infrastructure` | Como persiste e sincroniza: Supabase, Storage, Dexie, Workbox | `domain`, `application` (implementa ports) |
| `ui` | Como o usuário vê e age | `domain` (tipos) e `application` (casos de uso). Nunca `infrastructure` |

O backend neste projeto é o Supabase (Auth, Postgres, RLS, Storage). Não há API Node própria no MVP. A “aplicação” vive no cliente TypeScript; as invariantes críticas também são reforçadas no banco (constraints + RLS).

---

## 4. Contextos delimitados

Quatro contextos. No MVP são pastas, não packages nem deploys separados. A UI pode compor telas de vários contextos; o domínio de um contexto não importa o interior de outro — só IDs e contratos públicos.

```
┌──────────────────┐     ┌──────────────────┐
│ IdentityAccess   │     │ Ensemble         │
│ org, usuário,    │     │ músico, parte,   │
│ membership,      │     │ naipe, grupo,    │
│ papel, tema UI   │     │ atribuição       │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │  organizationId        │ musicianId, partId, sectionId
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│ Repertoire       │     │ Agenda           │
│ obra, categoria, │     │ evento, tipo,    │
│ tema, arquivos   │     │ programação      │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └──────────► leitura ◄───┘
                    Insights
         (histórico de execução; sem escrita própria)
```

| Contexto | Linguagem | MVP escreve | MVP lê |
|---|---|---|---|
| **IdentityAccess** | organização, membro, papel de sistema, preferência de tema (UI) | login, org, membership, tema | sessão, org corrente, tema |
| **Ensemble** | músico, parte, naipe, grupo, papel no grupo | CRUD básico | listagens |
| **Repertoire** | obra, categoria, tema de obra, partitura, áudio | catálogo + upload | busca, leitor |
| **Agenda** | evento, tipo de evento, programação | criar evento + obras | calendário, “última execução” |

**Insights** não é contexto de escrita. É consulta sobre `Agenda` + `Repertoire` (quantas vezes a obra entrou em culto no trimestre, última data, etc.).

---

## 5. Modelo de domínio

Catálogo detalhado de atributos, tabelas e invariantes: `project-models.md`. Abaixo, resumo alinhado ao modelo atual para orientar pastas e casos de uso.

### 5.1 Glossário

| Termo | Código | Significado |
|---|---|---|
| Organização | `Organization` | Tenant. Kairós é uma instância, não o sistema. |
| Membro | `Membership` | Vínculo usuário ↔ organização + papel de acesso. |
| Papel de acesso | `AccessRole` | Permissão no sistema (`owner`, `admin`, `member`). Distinto do papel musical. |
| Preferência de tema (UI) | `ThemePreference` | `light` ou `dark`. Do usuário, não da organização. Distinto de `PieceTheme`. |
| Músico | `Musician` | Pessoa da organização (titular, aluno, professor). Pode ter login depois. |
| Parte | `Part` | O que se toca ou canta: sax alto, violino, soprano. Catálogo por organização. Não é o naipe. |
| Divisão de parte | `PartDivision` | Cadeira na partitura de uma `Part` (trombone 1, 2, 3). Opcional. |
| Grupo | `Group` | Formação: orquestra, big band, coral, turma de aula. |
| Naipe | `Section` | Conjunto de pessoas dentro de um `Group` (cordas, madeiras, sopranos). |
| Papel no grupo | `EnsembleRole` | `member`, `teacher`, `section_lead`. |
| Atribuição | `Assignment` | Músico + grupo + naipe? + parte? + papel no grupo. |
| Obra | `Piece` | Item de repertório (não o arquivo). |
| Categoria | `PieceCategory` | Instrumental, HCA, Coral, Solo — configurável por org, com esses como padrão. Uma por obra. |
| Tema de obra | `PieceTheme` | Natal, Ceia, Adoração… configurável por org. N por obra (N:N). |
| Arquivo de obra | `PieceFile` | PDF ou áudio (mp3/wav). Liga a zero ou mais partes/divisões via links. |
| Tipo de evento | `EventType` | Ensaio de sábado, culto de terça, ceia, congresso, aula… por organização. |
| Evento | `Event` | Ocorrência na agenda (data/hora, tipo, local). |
| Item de programação | `ProgramItem` | Obra selecionada para um evento. |

Um músico pode ter várias atribuições. Exemplo do overview: Gustavo toca saxofone alto na big band (`member`, naipe saxofones, parte sax alto) e dá aula na turma de violino (`teacher`, parte violino).

### 5.2 Agregados

Agregados pequenos, para não travar o MVP nem o multi-tenant.

**IdentityAccess**

- `Organization` — id, name, slug, imageStorageKey? (identificador visual no seletor de orgs)
- `Membership` — organizationId, userId, accessRole
- `UserProfile` — dados do usuário autenticado; inclui `themePreference` (`light` \| `dark`)
- `GroupInvite` — link de convite por formação (`groupId`), tokenHash, expiresAt, revogação e aceite
- `PasswordRecoveryCode` — OTP de recuperação de senha (global ao usuário; não usa OTP do Supabase)

**Ensemble**

- `Musician` — dados cadastrais; `userId` opcional (ainda sem login)
- `Part` — name, kind (`instrument` \| `voice`), family?, sortOrder
- `PartDivision` — partId, name, sortOrder (cadeira na partitura; opcional por parte)
- `Group` — name, kind (`ensemble` \| `choir` \| `class` \| `other`)
- `Section` — groupId, name, sortOrder (naipe da formação)
- `Assignment` — musicianId, groupId, sectionId?, partId?, ensembleRole

**Repertoire**

- `Piece` — title, categoryId, composer?, description?, notes?; temas via N:N (`piece_theme_links`)
- `PieceCategory` — name, slug (ex.: `hca`), sortOrder, color?
- `PieceTheme` — name, slug, sortOrder
- `PieceFile` — pieceId, kind (`score` \| `audio`), storageKey, mimeType, originalName; partes via `piece_file_part_links` (partId, partDivisionId?)

**Agenda**

- `EventType` — name, kind (`rehearsal` \| `service` \| `class` \| `special`), sortOrder, color?
- `Event` — typeId, title?, startsAt, endsAt?, location?, notes?
- `ProgramItem` — eventId, pieceId, sortOrder, notes?

`ProgramItem` é o fato que alimenta Insights: cada vez que uma obra é programada (e, no futuro, marcada como executada), o histórico existe.

### 5.3 Relacionamentos

```
Organization
    ├── Membership ── UserProfile
    ├── GroupInvite ── Group
    ├── Musician ──? UserProfile
    ├── Part
    │     └── PartDivision
    ├── Group
    │     └── Section
    ├── Assignment (Musician, Group, Section?, Part?)
    ├── PieceCategory
    ├── PieceTheme
    ├── Piece
    │     ├── PieceTheme* (N:N)
    │     └── PieceFile
    │           └── Part* / PartDivision?* (N:N via links)
    ├── EventType
    └── Event
          └── ProgramItem (Piece)

UserProfile
    └── PasswordRecoveryCode
```

Pessoas vs. partitura:

```
Group          formação: orquestra, big band, coral, turma
  └── Section  naipe (gente): cordas, madeiras, sopranos
Part           o que se toca/canta: violino, trombone, soprano
  └── PartDivision  cadeira na página: trombone 1, 2, 3 (opcional)
```

### 5.4 Regras que o domínio deve garantir (mesmo no MVP)

1. Toda entidade de negócio pertence a exatamente uma `Organization`.
2. `Assignment`, `Piece`, `Event`, etc. só referenciam IDs da mesma organização.
3. `Section` pertence a exatamente um `Group`. Sem árvore: naipe não tem naipe-pai.
4. `PartDivision` pertence a exatamente uma `Part`. Não criar `Part` “Trombone 1” — isso é `Part` Trombone + divisões 1/2/3.
5. Se `Assignment.sectionId` existir, `section.groupId` = `assignment.groupId`.
6. Uma obra pode ter vários PDFs e vários áudios. PDFs ligam a partes/divisões via `piece_file_part_links`, não via FK único em `PieceFile`.
7. `PieceFile` não referencia `Section`. Partes e cadeiras vão nos links.
8. Evento sem programação é válido (aula ainda sem repertório, ou “vai ter ensaio amanhã” só com data).
9. Remover uma obra não apaga eventos passados: soft-delete da `Piece`; `ProgramItem` preserva histórico.
10. CPF e demais PII são dados da organização; acesso só via RLS daquele tenant (LGPD).
11. Papel de acesso (`admin`) ≠ papel musical (`teacher`). Não misturar num único enum.
12. `ThemePreference` (claro/escuro) é do `UserProfile`. Não vive em `Organization` nem em `Membership`. Distinto de `PieceTheme` (repertório).

Categorias de repertório, temas de obra e tipos de evento **não são hardcoded no código de UI**. Vêm do domínio da organização, com seed inicial inspirado no bloco do maestro (HCA, Instrumental, Coral, Solo; Natal, Ceia, Adoração; ensaios, cultos, ceia, congressos).

---

## 6. Persistência (Supabase)

O schema espelha o domínio. Nomes de tabela no plural, `snake_case`, sempre com `organization_id` quando for dado de tenant.

### 6.1 Tabelas do MVP

| Tabela | Agregado | Notas |
|---|---|---|
| `organizations` | Organization | `slug` único; `image_storage_key` nullable |
| `profiles` | UserProfile | 1:1 com `auth.users` (nome, e-mail, `theme`: `light` \| `dark`) |
| `memberships` | Membership | unique (organization_id, user_id) |
| `group_invites` | GroupInvite | token_hash; FK group_id |
| `password_recovery_codes` | PasswordRecoveryCode | sem organization_id |
| `musicians` | Musician | `user_id` nullable |
| `parts` | Part | unique (organization_id, name) sugerido |
| `part_divisions` | PartDivision | unique (part_id, name) |
| `groups` | Group | |
| `sections` | Section | unique (group_id, name); FK group_id |
| `assignments` | Assignment | section_id, part_id opcionais |
| `piece_categories` | PieceCategory | seed por org; slug único por org |
| `piece_themes` | PieceTheme | seed por org; slug único por org |
| `pieces` | Piece | `deleted_at` para soft-delete |
| `piece_theme_links` | Piece ↔ PieceTheme | unique (piece_id, theme_id) |
| `piece_files` | PieceFile | path no Storage; sem part_id direto |
| `piece_file_part_links` | PieceFile ↔ Part / PartDivision | unique (piece_file_id, part_id, part_division_id) com cuidado a NULL |
| `event_types` | EventType | seed por org |
| `events` | Event | |
| `program_items` | ProgramItem | unique (event_id, piece_id) no MVP |

Índices úteis já no MVP: `pieces(organization_id, title)`, `pieces(organization_id, category_id)`, `piece_theme_links(theme_id)`, `events(organization_id, starts_at)`, `program_items(piece_id)`, `piece_file_part_links(part_id)` — estes tornam busca por tema, “última vez / quantas vezes” e “PDFs da minha parte” baratos.

### 6.2 RLS (ideia, não a SQL)

- Usuário só vê linhas de organizações em que possui `memberships`.
- `member`: leitura ampla do tenant (repertório e agenda); escrita restrita.
- `admin` / `owner`: escrita no tenant.
- `profiles`: o próprio usuário lê e atualiza a linha dele (inclui `theme`).
- `group_invites`: leitura pública só por token válido (RPC ou policy restrita); escrita admin/owner na org.
- `password_recovery_codes`: escrita/leitura só via service role ou RPC — não expor hash na UI.
- Storage: mesmo recorte por `organization_id` no path (`{organizationId}/pieces/...`, `{organizationId}/branding/...`).

Policies detalhadas ficam nas migrations, não na UI.

### 6.3 Storage

Bucket privado (não público). Path sugerido:

```
{organizationId}/pieces/{pieceId}/{fileId}-{filename}
{organizationId}/branding/{fileId}-{filename}
```

O domínio conhece `storageKey` e metadados; quem fala com o SDK de Storage é só `infrastructure`. A imagem da organização vive em `Organization.imageStorageKey` (não em tabela separada).

---

## 7. Árvore de pastas

Monólito front + pasta `supabase`. Sem monorepo no MVP. Se o domínio crescer, `src/domain` pode virar package depois — a fronteira já existe.

```
planner-kairos/
├── project-overview.md
├── project-models.md             ← catálogo de entidades (fonte do domínio)
├── project-structure.md          ← este guia
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── public/
│   └── manifest.webmanifest
├── supabase/
│   ├── migrations/               ← schema, RLS, storage
│   └── seed/                     ← org de desenvolvimento
└── src/
    ├── main.tsx
    ├── domain/
    │   ├── shared/               ← IDs, Result, erros de domínio
    │   ├── identity/
    │   ├── ensemble/
    │   ├── repertoire/
    │   └── agenda/
    ├── application/
    │   ├── ports/                ← interfaces: PieceRepository, Clock…
    │   ├── identity/
    │   ├── ensemble/
    │   ├── repertoire/
    │   ├── agenda/
    │   └── insights/             ← GetPiecePerformanceHistory
    ├── infrastructure/
    │   ├── supabase/             ← client, repos, storage, auth
    │   └── pwa/                  ← workbox, dexie (esqueleto)
    └── ui/
        ├── app/                  ← providers, router, org context (só ID), ThemeProvider
        ├── theme/                ← tokens Tailwind claro/escuro (sem regra de negócio)
        ├── layouts/
        ├── pages/
        ├── components/           ← primitivos visuais (botão, tabela)
        └── features/             ← blocos de tela por contexto (sem regra de negócio)
```

### 7.1 O que vai em cada pasta de domínio

Cada contexto em `domain/<contexto>/` segue o mesmo formato:

```
domain/repertoire/
  piece.ts              # entidade
  piece-file.ts
  piece-category.ts
  piece-theme.ts
  rules.ts              # invariantes
  index.ts              # API pública do contexto

domain/ensemble/
  musician.ts
  part.ts
  part-division.ts
  group.ts
  section.ts
  assignment.ts
  rules.ts
  index.ts
```

Sem React, sem `fetch`, sem tipos gerados do Supabase.

### 7.2 Casos de uso (application)

Um arquivo por caso de uso, nomeado pela intenção:

| Contexto | Casos de uso do MVP |
|---|---|
| Identity | `SignIn`, `SignOut`, `ListMyOrganizations`, `SetCurrentOrganization`, `SetThemePreference`, `SetOrganizationImage`, `RemoveOrganizationImage` |
| Ensemble | `RegisterMusician`, `UpdateMusician`, `ListMusicians`, `RegisterPart`, `RegisterPartDivision`, `RegisterGroup`, `RegisterSection`, `AssignMusician` |
| Repertoire | `CatalogPiece`, `UpdatePiece`, `AttachPieceFile`, `SearchPieces`, `GetPiece`, `ManagePieceThemes` |
| Agenda | `ScheduleEvent`, `UpdateEvent`, `SetEventProgram`, `ListEventsInRange` |
| Insights | `GetPiecePerformanceHistory` (contagem + última data, filtrável por tipo de evento) |

A UI chama esses casos de uso (ou um façade fino por tela). Não monta queries SQL/Supabase na página.

### 7.3 Ports (contratos de infra)

Exemplos: `MusicianRepository`, `PieceRepository`, `EventRepository`, `FileStorage`, `AuthGateway`, `ProfileRepository`, `Clock`. Implementações em `infrastructure/supabase/`. O esqueleto PWA implementa os mesmos ports com Dexie só quando o offline entrar — a UI não muda.

Preferência de tema: fonte da verdade em `profiles.theme`. A infra pode espelhar em `localStorage` para pintar a tela antes do perfil carregar e para a tela de login; a UI não lê o storage direto.

### 7.4 UI

- `pages/` — rotas do MVP: login, recuperação de senha, convite, agenda, repertório, obra, evento, músicos.
- `features/<contexto>/` — composição visual (formulário de obra, calendário). Podem formatar datas para exibição; não calculam “última execução” na unha — chamam Insights.
- `components/` — átomos sem regra de orquestra (Button, Modal, DataTable). Usam tokens de `ui/theme`, nunca cores soltas.
- `theme/` — paleta e variáveis CSS/Tailwind (`dark:`). Aplica `light`/`dark` no documento; não decide persistência.
- `app/ThemeProvider` — lê a preferência via `SetThemePreference` / perfil; componentes só consomem a classe/tema já aplicado.

Troca de tema fica no layout autenticado (e na tela de login, com persistência local até haver sessão). Não é uma rota.

Rotas sugeridas (públicas: login, recuperação, convite; demais autenticadas sob a org):

```
/login
/login/recuperar-senha
/convite/:token
/orgs                              → escolher organização
/:orgSlug/agenda
/:orgSlug/repertorio
/:orgSlug/repertorio/:pieceId
/:orgSlug/eventos/:eventId
/:orgSlug/musicos
```

Responsividade e tema são requisitos de apresentação, não de orquestra: desktop (maestro), tablet (partitura), mobile (consulta rápida); claro/escuro via `ui/theme`. A preferência em si (`ThemePreference`) pertence a IdentityAccess.

---

## 8. Regras de dependência (lintável no futuro)

Permitido:

```
ui            → application, domain
application   → domain
infrastructure → application (ports), domain
```

Proibido:

```
domain        → application | infrastructure | ui | react | @supabase
application   → infrastructure | ui | react
ui            → infrastructure | @supabase | dexie
```

Na prática: o único lugar com `createClient` do Supabase é `infrastructure/supabase`. Páginas importam hooks/adapters da application, não o client.

Quando o ESLint estiver no ar, um `eslint-plugin-import` (ou `dependency-cruiser`) deve falhar o CI se essas setas forem violadas.

---

## 9. Fluxo típico (para não misturar camadas)

Exemplo: maestro inclui “Grande é o Senhor” no culto de domingo.

1. **UI** — página do evento dispara `setEventProgram({ eventId, pieceIds })`.
2. **Application** — valida membership na org corrente, carrega `Event` e `Piece`, monta `ProgramItem`s.
3. **Domain** — recusa peça de outra org ou peça soft-deleted.
4. **Infrastructure** — `insert` em `program_items` via repositório Supabase.
5. **Insights** (depois, outra tela) — `GetPiecePerformanceHistory` lê `program_items` + `events` e devolve `{ playCount, lastPerformedAt }` para a UI só exibir.

Nenhuma etapa 1 fala com a tabela; nenhuma etapa 3 importa React.

---

## 10. PWA e offline (estrutura agora, produto depois)

Pastas `public/manifest.webmanifest` e `src/infrastructure/pwa/` já existem no MVP para não refatorar o bootstrap.

| Fase | O que fazer |
|---|---|
| MVP | Service worker mínimo (Workbox): precache do app shell, app instalável |
| Seguinte | Dexie com as mesmas entidades de `domain`; sync puxando repos |
| Seguinte | Cache de `PieceFile` para leitura offline |

O domínio permanece o mesmo. Offline é adapter, não feature espalhada nas páginas.

---

## 11. Testes (onde vivem)

```
src/domain/**/*.test.ts          # regras e invariantes — prioridade no MVP
src/application/**/*.test.ts     # casos de uso com repos fake
src/ui/**/*.test.tsx             # só fluxos de tela críticos
```

Não é obrigatório cobertura alta no dia 1. É obrigatório que regras novas nasçam com teste de domínio, não só clique de UI.

---

## 12. Ordem de implementação sugerida

1. Scaffold Vite + TS + Tailwind (`darkMode: 'class'`) + pastas vazias das quatro camadas, incluindo `ui/theme`.
2. `supabase/migrations`: `organizations`, `profiles` (com `theme`), `memberships`, `group_invites`, `password_recovery_codes` + RLS.
3. Identity na application + telas de login, recuperação de senha, convite, troca de org + persistência da preferência de tema.
4. Ensemble: músicos, partes, grupos e naipes (no mínimo para não inventar atalho no assignment).
5. Repertoire: peças + Storage + busca.
6. Agenda: tipos de evento, eventos, programação.
7. Insights: histórico na ficha da obra (texto, sem gráfico).
8. PWA shell. Dexie só depois que o fluxo online estiver estável.

Essa ordem evita UI “bonita” acoplada a tabelas que ainda vão mudar, e garante que tenant e domínio existam antes do calendário.

---

## 13. O que este documento não é

- Não substitui migrations (o schema real vive em `supabase/migrations`).
- Não congela categorias ou tipos de evento no código.
- Não descreve pixels nem a paleta final; só exige tokens em `ui/theme` e preferência no perfil do usuário.
- Não inclui comunicação com músicos: quando existir, será um contexto `Communications` novo, dependendo de Identity e Ensemble, sem entrar em Repertoire/Agenda.
