# Modelo de entidades — Planner Kairós

Catálogo das entidades de domínio. Nomes de código em inglês; termos de negócio em português. Toda entidade de tenant tem `organizationId`. Fonte de verdade: PostgreSQL + RLS. Este documento descreve o modelo; o schema SQL vive em `supabase/migrations`.

Convenções:

- IDs são UUIDs.
- Timestamps de auditoria (`createdAt`, `updatedAt`) existem em todas as tabelas persistidas; omitidos abaixo salvo quando tiverem significado de negócio.
- Soft-delete só onde o histórico precisa sobreviver (`Piece`).
- Papel de acesso (`AccessRole`) ≠ papel musical (`EnsembleRole`).
- Nem toda entidade persistida é de tenant: `PasswordRecoveryCode` é global ao usuário (sem `organizationId`).

---

## Visão geral

```
IdentityAccess          Ensemble                 Repertoire              Agenda
─────────────────       ─────────────────        ─────────────────      ─────────────────
Organization            Musician                 PieceCategory          EventType
UserProfile             Part                     PieceTheme             Event
Membership              PartDivision             Piece                  ProgramItem
GroupInvite             Group                    PieceFile
PasswordRecoveryCode    Section
                        SectionPart (N:N Part)
                        Assignment

Insights (somente leitura): ProgramItem + Event + Piece → histórico de execução
```

Relacionamentos:

```
Organization
    ├── Membership ── UserProfile
    ├── GroupInvite ── Group
    ├── Musician ──? UserProfile
    ├── Part
    │     └── PartDivision
    ├── Group
    │     └── Section
    │           └── Part* (N:N via section_parts)
    ├── Assignment (Musician, Group, Section?, Part?)
    ├── PieceCategory
    ├── PieceTheme
    ├── Piece
    │     ├── PieceTheme* (N:N)
    │     └── PieceFile
    │           └── Part* / PartDivision?* (N:N)
    ├── EventType
    └── Event
          └── ProgramItem (Piece)

UserProfile
    └── PasswordRecoveryCode (global; sem organizationId)
```

Pessoas vs. partitura:

```
Group          formação: orquestra, big band, coral, turma
  └── Section  naipe (gente): cordas, madeiras, sopranos
Part           o que se toca/canta: violino, trombone, soprano
  └── PartDivision  cadeira na página: trombone 1, 2, 3 (opcional)
```

| | Formação (`Group`) | Naipe (`Section`) | Parte (`Part`) | Divisão |
|---|---|---|---|---|
| Orquestra | Orquestra titular | Metais | Trombone | 1, 2, 3 |
| Coral | Coral | Sopranos | Soprano | — (ou 1/2 se houver divisi) |
| Aula | Turma de violino | — | Violino | — |

`Section` é conjunto de pessoas. `Part` é o instrumento/voz do assignment. `PartDivision` é desdobramento da partitura, não outro instrumento e não um naipe. No coral, naipe e parte muitas vezes coincidem (`sopranos` / `soprano`); na orquestra, não (`madeiras` ≠ `flauta`).

---

## 1. IdentityAccess

Organização, autenticação, membership e preferências. Um usuário pode pertencer a várias organizações.

### 1.1 Organization

Tenant. A Orquestra Kairós é uma instância, não o sistema.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `name` | string | sim | Nome de exibição |
| `slug` | string | sim | Único globalmente; usado na URL (`/:orgSlug/...`) |
| `imageStorageKey` | string | não | Path no Storage da imagem de identificação visual (logo, brasão, foto). Null = sem imagem |

**Tabela:** `organizations`

Imagem de identificação (opcional):

- Uma organização tem no máximo uma imagem configurada.
- Formatos aceitos: `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`.
- Usada no seletor de organizações e, depois, em outros pontos de branding (cabeçalho, PWA por org).
- Sem imagem: a UI exibe fallback com as iniciais do `name`.
- Upload e remoção: `admin` / `owner`. Leitura: qualquer membro da org (signed URL).

Storage (bucket privado, mesmo bucket de `PieceFile`):

```
{organizationId}/branding/{fileId}-{filename}
```

Ao substituir a imagem, o arquivo anterior é removido do Storage e `imageStorageKey` é atualizado.

### 1.2 UserProfile

Perfil do usuário autenticado (1:1 com `auth.users` do Supabase). Não é o cadastro de músico.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | Igual a `auth.users.id` |
| `displayName` | string | sim | |
| `email` | string | sim | Espelhado do Auth |
| `themePreference` | `ThemePreference` | sim | `light` \| `dark`. Do usuário, não da org |

**Tabela:** `profiles`

Regras:

- Tema vale em todas as organizações do usuário. Não vive em `Organization` nem em `Membership`.
- O usuário só lê e atualiza a própria linha.

### 1.3 Membership

Vínculo usuário ↔ organização + papel de acesso ao sistema.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `userId` | UUID | sim | → `UserProfile` |
| `accessRole` | `AccessRole` | sim | `owner` \| `admin` \| `member` |

**Tabela:** `memberships`  
**Unique:** `(organizationId, userId)`

Regras:

- Cadastro por convite (`GroupInvite`) cria `Membership` com `accessRole` = `member` sempre; nunca `admin` nem `owner`.
- Promoção a `admin` ou `owner` só por ação explícita de quem já tem permissão de escrita no tenant.
- Usuário sem nenhuma `Membership` autentica, mas não entra em org — a UI mostra “sem acesso”.

### 1.4 GroupInvite

Link de convite para criação de conta, associado a uma formação (`Group`) da organização. Página pública; após aceitar, o usuário entra direto na org do convite.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `groupId` | UUID | sim | → `Group`. Formação à qual o novo músico será vinculado |
| `tokenHash` | string | sim | Hash do token da URL; usado no lookup público (`get_invite_preview`, `redeem_group_invite`) |
| `token` | string | não | Token em claro para o admin copiar o link de novo; preenchido na criação; visível só via RPC/RLS de admin |
| `expiresAt` | datetime | sim | Validade determinada na criação; editável em convites ativos (`update_group_invite_expires`) |
| `revokedAt` | datetime | não | Preenchido quando admin revoga/exclui o link antes do uso |
| `createdByUserId` | UUID | sim | → `UserProfile`. Quem gerou o convite |
| `redeemedAt` | datetime | não | Preenchido no aceite bem-sucedido |
| `redeemedByUserId` | UUID | não | → `UserProfile`. Quem aceitou |

**Tabela:** `group_invites`  
**Índice:** `(token_hash)` — lookup na página pública de convite

Regras:

- `group` e `organizationId` da mesma organização.
- Convite **válido** quando: `revokedAt` é null, `redeemedAt` é null, `expiresAt` > agora e o `group` não está arquivado (`archivedAt` null).
- Uso único: após aceite, `redeemedAt` e `redeemedByUserId` são preenchidos; o link não aceita outro cadastro.
- Criação, listagem, revogação e alteração de `expiresAt`: `admin` / `owner`. A página de aceite (token na URL) é pública, sem sessão.
- Não é possível criar convite nem aceitar link para `Group` arquivado.
- Aceite atômico via RPC `redeem_group_invite` (um caso de uso): cria `Membership` (`member`) + `Musician` (`userId`, `fullName` e `email` do perfil; `phone` e `birthDate` opcionais informados no formulário de aceite) + `Assignment` (`musician`, `groupId`, `ensembleRole` = `member`, sem `sectionId`/`partId` no MVP). Conta no Auth e `UserProfile` já existem antes do aceite (cadastro na página de convite).
- Se já existir `Membership` ou `Musician` com o mesmo `userId` na org, falha (`already_member` / `musician_exists`).
- Vários convites ativos por org/grupo são permitidos; cada um com token próprio.

### 1.5 PasswordRecoveryCode

Código OTP para recuperação/alteração de senha. **Não** usa o OTP do Supabase Auth — o sistema dispara e-mail próprio e valida o código aqui.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `userId` | UUID | sim | → `UserProfile` |
| `email` | string | sim | E-mail informado na solicitação (espelho para auditoria) |
| `codeHash` | string | sim | Hash do OTP de 6 dígitos (ou similar); nunca persistir o código em claro |
| `expiresAt` | datetime | sim | Validade curta (ex.: 15 minutos — detalhe de implementação) |
| `usedAt` | datetime | não | Preenchido quando o código é consumido com sucesso |

**Tabela:** `password_recovery_codes`  
**Índice:** `(user_id, expires_at)` — invalidar códigos antigos ao emitir novo

Regras:

- Sem `organizationId` — recuperação é do usuário, não do tenant.
- Solicitação a partir da tela de login (página pública). Resposta genérica (“se o e-mail existir…”) para não vazar cadastro.
- Uso único: após validação, `usedAt` é preenchido e a senha é alterada via Auth (service role ou API segura na infra).
- Ao emitir novo código para o mesmo `userId`, códigos anteriores não usados podem ser invalidados (implementação).
- Rate limit na infra (por IP / e-mail) — fora do modelo, mas obrigatório na implementação.

### 1.6 Value objects / enums

| Nome | Valores | Significado |
|---|---|---|
| `AccessRole` | `owner`, `admin`, `member` | Permissão no sistema. `member` lê repertório e agenda; `admin`/`owner` escrevem no tenant. |
| `ThemePreference` | `light`, `dark` | Preferência visual do usuário. |

---

## 2. Ensemble

Pessoas da organização, formações, naipes e partes (instrumento ou voz). Um músico pode ter várias atribuições (ex.: sax alto na big band como integrante e professor na turma de violino).

### 2.1 Musician

Pessoa da organização com registro em `musicians`. No MVP, criada apenas pelo aceite de convite (sempre com `userId` preenchido).

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `fullName` | string | sim | |
| `birthDate` | date | não | Aniversário; pode ser informado no aceite do convite |
| `phone` | string | não | Contato; normalizado (só dígitos) no aceite do convite |
| `email` | string | não | Contato; no aceite do convite, espelhado do `UserProfile` |
| `userId` | UUID | não | Liga ao `UserProfile` quando o músico tiver login |
| `notes` | string | não | |

**Tabela:** `musicians`  
**Unique:** `(organizationId, userId)` — um login não vira dois músicos na mesma org

Regras:

- Dados de contato (`phone`, `email`) são da organização; nunca vazam entre tenants.
- **Criação** só via RPC `redeem_group_invite` (aceite de convite). Não há `INSERT` direto por admin — o cadastro de músico na org passa pelo convite.
- Admin/owner **atualiza** campos do músico e pode **excluir** (assignments em cascata).
- **Leitura (RLS):** admin/owner vê todos os músicos da org; `member` vê apenas o próprio registro (`userId` = usuário autenticado).
- Aceite de `GroupInvite` cria `Musician` com `userId`, `fullName`, `email`; `phone` e `birthDate` opcionais no formulário de aceite. Demais campos o admin completa depois.

### 2.2 Part

Catálogo por organização da **parte** musical: o que se toca ou canta, e o que a partitura nomeia. Cobre instrumento (saxofone alto, violino) e voz (soprano, tenor). Não é o naipe — naipe é `Section`.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `name` | string | sim | |
| `kind` | `PartKind` | sim | `instrument` \| `voice` |
| `sortOrder` | int | sim | |

**Tabela:** `parts`  
**Unique:** `(organizationId, name)` sugerido

Usado em `Assignment` (quem toca/canta o quê). Arquivos não apontam para `Part` com um FK único: ligam-se a uma ou mais partes (e divisões) via `piece_file_part_links`. O catálogo é da organização, não do grupo: a partitura de sax alto é da obra, não da big band.

Não criar `Part` “Trombone 1” nem “Trombone 1+2”. Isso é `Part` Trombone + `PartDivision` 1 e 2 (e o arquivo com dois links).

### 2.3 PartDivision

Cadeira ou divisi **de uma** `Part`, quando a editora separa o que na prática é o mesmo instrumento/voz. Não é `Part` filha nem `Section`.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `partId` | UUID | sim | |
| `name` | string | sim | Ex.: `1`, `2`, `3`, `div. A` |
| `sortOrder` | int | sim | |

**Tabela:** `part_divisions`  
**Unique:** `(partId, name)`

Regras:

- Pertence a exatamente uma `Part` da mesma organização.
- Zero ou mais por parte. Sax alto e soprano sem divisi não têm linhas.
- Seed só onde a org precisa (trombone 1/2/3, flauta 1/2), não em toda `Part`.
- No MVP o `Assignment` aponta para `Part`, não para a divisão. Cadeira no assignment fica para depois.

### 2.4 Group

Formação: orquestra, big band, coral, turma de aula. Não é o naipe — naipe é `Section`, filho deste grupo.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `name` | string | sim | |
| `kind` | `GroupKind` | sim | `ensemble` \| `choir` \| `class` \| `other` |
| `notes` | string | não | |
| `archivedAt` | datetime | não | Arquivamento suave; null = ativo |

**Tabela:** `groups`  
**Índice:** `(organizationId)` parcial onde `archivedAt` IS NULL — listagem de grupos ativos

Regras:

- Sem `parentId`. Hierarquia para no máximo um nível, via `Section`.
- Turma de aula costuma não ter seções.
- Um grupo pode ter zero ou várias seções.
- **Arquivamento:** preencher `archivedAt` oculta o grupo da listagem padrão. Grupo arquivado não aceita novos convites nem aceite de link; músicos e assignments existentes permanecem.
- Restaurar grupo = limpar `archivedAt` (admin/owner).

### 2.5 Section

Naipe de uma formação: cordas, madeiras, saxofones, sopranos. Pertence a exatamente um `Group`. Não há seção de seção.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `groupId` | UUID | sim | Formação à qual o naipe pertence |
| `name` | string | sim | |
| `sortOrder` | int | sim | |
| `notes` | string | não | |

**Tabela:** `sections`  
**Unique:** `(groupId, name)`

Regras:

- `group` e `section` da mesma organização.
- No coral, o naipe (sopranos) muitas vezes coincide com a `Part` (soprano). Não é obrigatório preencher os dois no assignment.
- As partes que compõem o naipe são definidas em `SectionPart` (composição N:N com `Part`).

### 2.5.1 SectionPart

Composição entre `Section` e `Part`: quais partes pertencem a cada naipe. A mesma `Part` pode entrar em naipes de grupos diferentes (ex.: violino em cordas da orquestra e em turma de violino), mas dentro de um naipe só as partes vinculadas são válidas em atribuições.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `sectionId` | UUID | sim | |
| `partId` | UUID | sim | |
| `organizationId` | UUID | sim | Redundante para RLS; deve coincidir com org de `section` e `part` |

**Tabela:** `section_parts`  
**Primary key:** `(sectionId, partId)`

Exemplos:

| Section (naipe) | Parts vinculadas |
|---|---|
| Cordas (Orquestra) | Violino, Viola, Violoncelo, Contrabaixo |
| Saxofones (Big Band) | Sax alto, Sax tenor, Sax barítono |
| Sopranos (Coral) | Soprano |

Regras:

- `section` e `part` da mesma organização.
- Zero ou mais partes por naipe; o admin configura na ficha do grupo.
- Se `Assignment` tem `sectionId` e `partId`, a parte deve estar vinculada ao naipe em `section_parts`.
- Atribuição só com naipe (sem parte) ou só com parte (sem naipe) continua válida quando o papel exige (chefe de naipe, professor).

### 2.6 Assignment

Atribuição: músico + formação + papel, com naipe e parte opcionais.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `musicianId` | UUID | sim | |
| `groupId` | UUID | sim | Formação |
| `sectionId` | UUID | não | Naipe; se preenchido, `section.groupId` = este `groupId` |
| `partId` | UUID | não | Parte tocada/cantada |
| `ensembleRole` | `EnsembleRole` | sim | `member` \| `teacher` \| `section_lead` |

**Tabela:** `assignments`

Exemplos:

| Pessoa | Group | Section | Part | Role |
|---|---|---|---|---|
| Gustavo | Big band | Saxofones | Sax alto | `member` |
| Maria | Coral | Sopranos | Soprano (ou omitida) | `member` |
| Chefe de naipe | Orquestra | Cordas | — | `section_lead` |
| Professor | Turma de violino | — | Violino | `teacher` |

Regras:

- Músico, grupo, seção (se houver) e parte (se houver) pertencem à mesma organização.
- Se `sectionId` estiver preenchido, a seção pertence àquele `groupId`.
- Se `sectionId` e `partId` estiverem preenchidos, a parte deve estar vinculada ao naipe em `section_parts`.
- `section_lead` só faz sentido com `sectionId`.
- Sem `partDivisionId` no MVP: a pessoa toca trombone / soprano; a cadeira 1/2/3 é metadado do arquivo.
- Um músico pode ter várias linhas (vários grupos / naipes / partes / papéis).
- **Unique:** índice em `(musicianId, groupId, COALESCE(sectionId, sentinel), COALESCE(partId, sentinel), ensembleRole)` — `sectionId`/`partId` nulos usam UUID sentinela para deduplicar corretamente.

### 2.7 Value objects / enums

| Nome | Valores | Significado |
|---|---|---|
| `GroupKind` | `ensemble`, `choir`, `class`, `other` | Natureza da formação. Naipe não é um kind de grupo. |
| `PartKind` | `instrument`, `voice` | Ajuda a UI; o restante do modelo trata `Part` igual. |
| `EnsembleRole` | `member`, `teacher`, `section_lead` | Papel musical. Distinto de `AccessRole`. `section_lead` = chefe de naipe. |

---

## 3. Repertoire

Catálogo de obras e arquivos. A obra é o item de repertório; os arquivos (PDF/áudio) são anexos.

Filtro estruturado tem duas dimensões, ambas configuráveis por organização e sem hardcode na UI:

- **Categoria** (1 por obra): tipo de repertório — Instrumental, HCA, Coral, Solo.
- **Temas** (N por obra): facetas para busca — Natal, Ceia, Adoração, Congresso. Uma obra pode servir a mais de um.

Texto livre não substitui nenhum dos dois: vai em `description` (o que é a obra) e `notes` (anotação operacional).

### 3.1 PieceCategory

Categoria configurável por organização. Seed inicial inspirado no bloco do maestro.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `name` | string | sim | Ex.: Instrumental, HCA, Coral, Solo |
| `slug` | string | sim | Ex.: `hca`. Único por organização |
| `sortOrder` | int | sim | Ordem na UI |
| `color` | string | não | Cor de exibição: token da paleta do projeto (ex.: `blue-500`) ou hex (`#3B82F6`). Badges e filtros no catálogo |

**Tabela:** `piece_categories`

Seed sugerido por org: Instrumental, HCA, Coral, Solo. Não hardcodar na UI.

Regras:

- `color` é opcional. A obra herda a cor da categoria via `categoryId` (badges na listagem e ficha).
- Se vazio, a UI aplica cor automática (ex.: por `sortOrder` ou `slug`).

### 3.2 PieceTheme

Tema configurável por organização. Vocabulário controlado para filtrar o catálogo — distinto de `ThemePreference` (claro/escuro na UI).

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `name` | string | sim | Ex.: Natal, Páscoa, Ceia, Adoração, Congresso, Cantata |
| `slug` | string | sim | Ex.: `ceia`. Único por organização |
| `sortOrder` | int | sim | Ordem na UI |

**Tabela:** `piece_themes`

Seed sugerido por org: Natal, Páscoa, Ceia, Adoração, Congresso. A org inclui, renomeia e omite à vontade. Não hardcodar na UI.

Uma obra liga-se a zero ou mais temas. A associação não é um agregado à parte:

**Tabela:** `piece_theme_links`  
**Unique:** `(pieceId, themeId)`

Regras:

- Tema e obra da mesma organização.
- Apagar um tema do catálogo remove os links; as obras permanecem.

### 3.3 Piece

Item de repertório. Não é o arquivo.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `title` | string | sim | |
| `categoryId` | UUID | sim | → `PieceCategory`. Uma categoria por obra |
| `composer` | string | não | |
| `description` | string | não | Texto livre sobre a obra. Não é filtro |
| `notes` | string | não | Anotação operacional (maestro/arquivista) |
| `deletedAt` | datetime | não | Soft-delete; histórico de eventos permanece |

Temas: N:N via `piece_theme_links` → `PieceTheme`. Não há campo `theme` na obra.

**Tabela:** `pieces`  
**Índice:** `(organizationId, title)`  
**Índice (filtro):** `piece_theme_links(theme_id)` e `pieces(organization_id, category_id)`

Regras:

- Remover uma obra não apaga eventos passados: soft-delete. `ProgramItem` continua apontando para a obra.
- Obra soft-deleted não entra em programação nova.
- Busca por tema usa os links, não `description`.

### 3.4 PieceFile

Arquivo de uma obra: partitura (PDF) ou áudio (mp3/wav). Não tem `partId`. Cobre zero ou mais partes/divisões via links — nunca aponta para `Section`.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `pieceId` | UUID | sim | |
| `kind` | `PieceFileKind` | sim | `score` \| `audio` |
| `storageKey` | string | sim | Path no Storage; o domínio não fala com o SDK |
| `mimeType` | string | sim | `application/pdf`, `audio/mpeg`, `audio/wav`… |
| `originalName` | string | sim | Nome original do upload |
| `byteSize` | int | não | Útil para cache/offline depois |

**Tabela:** `piece_files`

Storage (bucket privado):

```
{organizationId}/pieces/{pieceId}/{fileId}-{filename}
```

Associação com partes (N:N), no mesmo espírito de `piece_theme_links`:

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `pieceFileId` | UUID | sim | |
| `partId` | UUID | sim | |
| `partDivisionId` | UUID | não | Null = a parte inteira, sem cadeira |

**Tabela:** `piece_file_part_links`  
**Unique:** `(pieceFileId, partId, partDivisionId)` — tratamento de NULL na migration  
**Índice:** `(partId)`, `(partDivisionId)`

| Arquivo | Links |
|---|---|
| Trombone 1+2.pdf | (Trombone, 1), (Trombone, 2) |
| Trombone 3.pdf | (Trombone, 3) |
| SATB.pdf | (Soprano, —), (Alto, —), (Tenor, —), (Baixo, —) |
| SA.pdf | (Soprano, —), (Alto, —) |
| Sax alto.pdf | (Sax alto, —) |
| Partitura geral / áudio | nenhum link |

Regras:

- Uma obra pode ter vários PDFs e vários áudios.
- Parte e divisão (se houver) da mesma organização; se `partDivisionId` existir, `division.partId` = `link.partId`.
- Zero links = não é de uma parte específica (maestro, redução, mp3). SATB **não** vai nesse saco: tem um link por voz.
- “PDFs da minha parte” (MVP): links com o `partId` do assignment, com ou sem divisão, mais arquivos sem links se a UI oferecer a partitura geral.

### 3.5 Value objects / enums

| Nome | Valores | Significado |
|---|---|---|
| `PieceFileKind` | `score`, `audio` | Partitura vs. áudio |

---

## 4. Agenda

Eventos da organização e o repertório escolhido para cada um. Evento sem programação é válido (aula ainda sem obras, ou “vai ter ensaio amanhã” só com data).

### 4.1 EventType

Tipo configurável por organização. Seed inicial a partir do bloco do maestro.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `name` | string | sim | Ex.: Ensaio de sábado, Culto de terça, Ceia |
| `kind` | `EventKind` | sim | `rehearsal` \| `service` \| `class` \| `special` |
| `sortOrder` | int | sim | |
| `color` | string | não | Cor de exibição: token da paleta do projeto (ex.: `amber-500`) ou hex (`#F59E0B`). Calendário e legenda da agenda |

**Tabela:** `event_types`

Seed sugerido por org:

| Nome | `kind` |
|---|---|
| Ensaio de sábado | `rehearsal` |
| Ensaio de domingo | `rehearsal` |
| Culto de terça | `service` |
| Culto de sábado | `service` |
| Culto de domingo | `service` |
| Culto de ceia | `service` |
| Aula | `class` |
| Congresso / evento especial | `special` |

Não hardcodar na UI. `kind` alimenta Insights (ex.: “quantas vezes em culto no trimestre”).

Regras:

- `color` é opcional. `Event` herda a cor do tipo via `typeId` (blocos no calendário, legenda).
- Se vazio, fallback por `kind` (`rehearsal`, `service`, `class`, `special`) com paleta padrão do projeto.

### 4.2 Event

Ocorrência na agenda.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `typeId` | UUID | sim | → `EventType` |
| `title` | string | não | Sobrescreve o nome do tipo quando útil (ex.: “Cantata de Natal”) |
| `startsAt` | datetime | sim | |
| `endsAt` | datetime | não | |
| `location` | string | não | |
| `notes` | string | não | |

**Tabela:** `events`  
**Índice:** `(organizationId, startsAt)`

Regras:

- `endsAt`, se existir, é ≥ `startsAt`.
- Tipo pertence à mesma organização.

### 4.3 ProgramItem

Obra selecionada para um evento. É o fato que alimenta Insights: cada inclusão na programação (e, no futuro, marcação como executada) gera histórico.

| Atributo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | UUID | sim | |
| `organizationId` | UUID | sim | |
| `eventId` | UUID | sim | |
| `pieceId` | UUID | sim | |
| `sortOrder` | int | sim | Ordem no culto/ensaio |
| `notes` | string | não | MVP: texto livre. Depois: tonalidade, arranjo |

**Tabela:** `program_items`  
**Unique (MVP):** `(eventId, pieceId)` — a mesma obra não entra duas vezes no mesmo evento  
**Índice:** `(pieceId)` — “quantas vezes / última vez” barato

Regras:

- Evento e obra da mesma organização.
- Obra soft-deleted não pode ser adicionada; itens já existentes permanecem.

### 4.4 Value objects / enums

| Nome | Valores | Significado |
|---|---|---|
| `EventKind` | `rehearsal`, `service`, `class`, `special` | Família do tipo; filtro de Insights |

---

## 5. Insights (leitura)

Não é contexto de escrita. Não tem entidade própria. Consulta sobre `ProgramItem` + `Event` + `Piece`.

Projeção típica (`GetPiecePerformanceHistory`):

| Campo | Origem |
|---|---|
| `playCount` | Contagem de `program_items` da obra, filtrável por `EventKind` / intervalo |
| `lastPerformedAt` | `MAX(events.startsAt)` dos eventos em que a obra entrou |

No MVP: texto na ficha da obra. Relatórios visuais (trimestre, escalas mensais/anuais, por naipe) usam os mesmos dados depois — escalas por naipe leem `Section` + `Assignment`.

---

## 6. Entidades fora do núcleo (depois)

Não modelar agora. Quando existirem, contexto novo — sem misturar em Repertoire/Agenda.

| Necessidade (overview) | Por que espera |
|---|---|
| Comunicação (WhatsApp, e-mail) por músico, naipe, chefe de naipe | Canal à parte (`Communications`), dependendo de Identity + Ensemble |
| Cadastro manual de músico (sem convite / pré-login) | Hoje só via `redeem_group_invite`; pré-cadastro pelo admin exigiria novo fluxo e policy de `INSERT` |
| Convites com `accessRole` configurável no link, convite por e-mail nominativo, reenvio | Evolução de `GroupInvite` + `Membership` |
| Escalas por naipe, disponibilidade, turmas | Evolução de `Assignment` + `Section` + `Event`; IDs já existem |
| Cadeira no assignment (`partDivisionId`: “você é trombone 1”) | Evolução de `Assignment`; arquivos já usam `PartDivision` |
| Versionamento de obras, arranjos, metadados ricos | Evolução de `Piece` / `PieceFile` |
| Presença em evento, recorrência, conflitos | Evolução de `Event` |
| Marcar obra como “executada” (vs. só programada) | Campo futuro em `ProgramItem`; até lá, programar = histórico |
| Cache Dexie / arquivos offline | Mesmas entidades; adapter, não modelo novo |

---

## 7. Invariantes transversais

1. Toda entidade de negócio pertence a exatamente uma `Organization`.
2. Relacionamentos só entre IDs da mesma organização (`Assignment`, `PieceFile`, `ProgramItem`, etc.).
3. `Section` pertence a exatamente um `Group`. Sem árvore: naipe não tem naipe-pai.
4. `PartDivision` pertence a exatamente uma `Part`. Sem árvore: divisão não tem divisão-filha. Não reusar `Section` nem `Part.parentId`.
5. Se `Assignment.sectionId` existir, `section.groupId` = `assignment.groupId`.
6. Se `Assignment.sectionId` e `Assignment.partId` existirem, a parte deve estar em `section_parts` para aquele naipe.
7. `PieceFile` não referencia `Section`. Partes e cadeiras vão em `piece_file_part_links`.
8. Se um link tiver `partDivisionId`, `division.partId` = `link.partId`.
9. `AccessRole` (sistema) e `EnsembleRole` (música) são enums distintos.
10. `ThemePreference` é do `UserProfile`.
11. Evento sem `ProgramItem` é válido.
12. Soft-delete de `Piece` preserva `ProgramItem` histórico.
13. Categorias, temas de obra e tipos de evento vêm do domínio da org, não de constantes na UI.
14. `ThemePreference` (UI) ≠ `PieceTheme` (repertório).
15. Cor de exibição de `Event` vem de `EventType`; cor de `Piece` no catálogo vem de `PieceCategory`. Nenhum dos dois duplica cor no agregado filho.
16. `Organization.imageStorageKey` é opcional e único por org (no máximo um arquivo). Não é entidade separada — o path vive na linha de `organizations`.
17. Aceite de `GroupInvite` cria `Membership` com `accessRole` = `member` — nunca `admin` nem `owner`.
18. Aceite de `GroupInvite` cria `Musician` com `userId` na mesma org e `Assignment` no `groupId` do convite (`ensembleRole` = `member`). `phone` e `birthDate` opcionais vêm do formulário de aceite.
19. `GroupInvite` válido: `revokedAt` null, `redeemedAt` null, `expiresAt` no futuro e `group.archivedAt` null.
20. Lookup de convite usa `tokenHash`; OTP de recuperação persiste só como `codeHash`. O token em claro do convite também fica em `group_invites.token` para o admin recopiar o link (acesso restrito a admin/owner). Na página pública o token vem da URL.
21. `PasswordRecoveryCode` não tem `organizationId`; pertence ao `UserProfile`.
22. Recuperação de senha não usa OTP do Supabase Auth — só `PasswordRecoveryCode` + e-mail próprio.
23. `Musician` só é criado via `redeem_group_invite`; admin atualiza e exclui, mas não insere diretamente.
24. `member` só lê o próprio `Musician`; listagem completa da org é `admin`/`owner`.
25. `Group` arquivado (`archivedAt` preenchido) não aceita convites novos nem aceite de link.

---

## 8. Mapa tabela ↔ agregado (MVP)

| Tabela | Agregado | Unique / índice relevante |
|---|---|---|
| `organizations` | Organization | `slug` único; `image_storage_key` nullable |
| `profiles` | UserProfile | 1:1 `auth.users` |
| `memberships` | Membership | `(organization_id, user_id)` |
| `group_invites` | GroupInvite | `(token_hash)`; `token` nullable (admin); FK `group_id` |
| `password_recovery_codes` | PasswordRecoveryCode | `(user_id, expires_at)`; sem `organization_id` |
| `musicians` | Musician | `(organization_id, user_id)`; `phone`, `email`; sem insert direto (só RPC) |
| `parts` | Part | `(organization_id, name)` |
| `part_divisions` | PartDivision | `(part_id, name)` |
| `groups` | Group | `archived_at` nullable; índice parcial para ativos |
| `sections` | Section | `(group_id, name)` |
| `section_parts` | Section ↔ Part | `(section_id, part_id)` |
| `assignments` | Assignment | unique com `COALESCE` em `section_id`/`part_id`; trigger valida `section_parts` |
| `piece_categories` | PieceCategory | `(organization_id, slug)` |
| `piece_themes` | PieceTheme | `(organization_id, slug)` |
| `pieces` | Piece | `(organization_id, title)`; `(organization_id, category_id)`; `deleted_at` |
| `piece_theme_links` | Piece ↔ PieceTheme | `(piece_id, theme_id)`; índice em `theme_id` |
| `piece_files` | PieceFile | |
| `piece_file_part_links` | PieceFile ↔ Part / PartDivision | `(piece_file_id, part_id, part_division_id)` com cuidado a NULL; índices em `part_id` |
| `event_types` | EventType | |
| `events` | Event | `(organization_id, starts_at)` |
| `program_items` | ProgramItem | `(event_id, piece_id)`; índice em `piece_id` |
