# Planner Kairós - Gestão de repertório e Agenda da Orquestra Kairós

Este projeto nasceu da necessidade de um maestro e sua equipe em dispor de melhores ferramentas para gerir a Orquestra Kairós, que é a orquestra da Assembleia de Deus em Apucarana - PR. O grupo conta hoje com mais de 60 músicos titulares, além de dezenas de alunos e uma agenda semanal extensa, com aulas ministradas por múltiplos professores, ensaios, participações em pelo menos 1 culto por semana, além de eventos especiais que ocorrem ao longo do ano, como congressos, simpósios e cantatas.

Na reunião que tivemos, o maestro me mostrou um bloco de notas gigante no tablet dele onde tem anotado o repertório executado em cada culto desde o início do ano. A ideia dele em organizar o histórico é conseguir ter informação para selecionar as próximas músicas evitando repetições, entre outros detalhes como componentes à disposição e tema.

Nessa reunião, ele me passou essas anotações sobre a solução que está imaginando:
- Repertório (busca pelos músicos) PDF e áudios
    - Instrumental
    - HCA
    - Coral
    - Solo
- Escalas e eventos mensais (relatório)
    - Semanal
    - Mensal
    - Anual
- Relatório
    - Ensaio de sábado
    - Ensaio de domingo
    - Culto de Terça
    - Culto de sábado
    - Culto de domingo
    - Culto de Ceia
    - Congressos e eventos
- Cadastro músicos (aniversário)
    - Nome
    - Data nascimento
    - Escolaridade
    - CPF
- Comunicação com os músicos, naipes, chefe de naipes e outros...
    - WhatsApp
    - E-mail

E juntando com o que conversamos, esse é o sonho que iremos realizar:

## Modelo de domínio (resumo)

O catálogo completo de entidades está em [`project-models.md`](project-models.md). Aqui, os termos que aparecem nas features abaixo:

| Contexto | O que modela | Entidades principais |
|---|---|---|
| **IdentityAccess** | Tenant, login, convites, recuperação de senha e permissões no sistema | `Organization`, `UserProfile`, `Membership`, `GroupInvite`, `PasswordRecoveryCode` |
| **Ensemble** | Pessoas, formações, naipes e partes | `Musician`, `Group`, `Section`, `Part`, `Assignment` |
| **Repertoire** | Obras e arquivos | `Piece`, `PieceCategory`, `PieceTheme`, `PieceFile` |
| **Agenda** | Eventos e programação | `EventType`, `Event`, `ProgramItem` |

Distinções importantes já definidas no modelo:

- **Organização (`Organization`)** — tenant. A Orquestra Kairós é uma instância, não o sistema. Um usuário pode pertencer a várias organizações. Cada org pode ter uma imagem de identificação visual (logo, brasão) exibida no seletor de organizações.
- **Músico vs. usuário** — `Musician` é o cadastro da pessoa na organização (titular, aluno, professor); pode existir sem login. `UserProfile` é quem autentica; liga-se ao músico quando houver conta.
- **Papel de acesso vs. papel musical** — `AccessRole` (`owner`, `admin`, `member`) controla o que se pode fazer no sistema; `EnsembleRole` (`member`, `teacher`, `section_lead`) descreve a função na orquestra. São enums distintos.
- **Formação, naipe e parte** — `Group` é a formação (orquestra, big band, coral, turma). `Section` é o naipe dentro dela (cordas, sopranos). `Part` é o instrumento ou voz (violino, soprano); `PartDivision` é a cadeira na partitura (trombone 1, 2, 3), não outro instrumento nem naipe.
- **Atribuição (`Assignment`)** — liga músico + formação + papel musical, com naipe e parte opcionais. Ex.: Gustavo, sax alto, big band, integrante; ou professor na turma de violino.
- **Obra vs. arquivo** — `Piece` é o item de repertório; `PieceFile` é PDF ou áudio anexo. Arquivos ligam-se a uma ou mais partes via links, não a naipes.
- **Categoria vs. tema da obra** — `PieceCategory` classifica o tipo (Instrumental, HCA, Coral, Solo — uma por obra). `PieceTheme` são facetas de busca (Natal, Ceia, Adoração, Congresso — N por obra). Não confundir com `ThemePreference` (tema claro/escuro da UI).
- **Agenda e histórico** — `Event` é a ocorrência; `ProgramItem` é a obra programada no evento. Esse vínculo alimenta **Insights** (quantas vezes tocou, última execução) — consulta de leitura, sem entidade própria.

Categorias de obra, temas e tipos de evento são configuráveis por organização (seed inicial inspirado nas listas do maestro acima), não hardcoded na UI.

## Principais features e requisitos

### Cadastro de músicos, partes, formações e atribuições

Além de informações básicas do músico (nome, data de nascimento, escolaridade, CPF), o sistema gerencia **atribuições**: qual músico participa de qual **formação** (`Group`), em qual **naipe** (`Section`, quando aplicável), tocando ou cantando qual **parte** (`Part`), com qual **papel musical** (`EnsembleRole`: integrante, professor ou chefe de naipe).

Exemplo: Gustavo toca saxofone alto na big band (integrante) e dá aula na turma de violino (professor). Um músico pode ter várias atribuições; login é opcional — o cadastro existe mesmo sem conta.

Quem tem login entra via `UserProfile` e acessa organizações através de `Membership`, com `AccessRole` que define permissão de leitura ou escrita no tenant.

### Repositório online do repertório da orquestra

A orquestra possui um vasto repertório, acumulado ao longo de quase 3 décadas de atividade. Esse repertório conta com partituras em PDF (frequentemente um arquivo por parte ou cadeira) e áudios em MP3 e WAV.

Cada **obra** (`Piece`) tem título, **categoria** (Instrumental, HCA, Coral, Solo), **temas** opcionais para filtro (Natal, Ceia, etc.), compositor e notas. Os **arquivos** (`PieceFile`) são anexos de partitura ou áudio; cada PDF pode cobrir uma ou mais partes (ex.: trombone 1+2, SATB com link por voz, partitura geral sem link específico).

A ideia é catalogar, disponibilizar e manter online todo o repertório, para que músicos cadastrados acessem as partes relevantes ao seu assignment — reduzindo a dependência do "arquivista", que hoje é o próprio maestro titular.

### Agenda de ensaios, aulas e eventos com repertório selecionado

"Vai ter ensaio amanhã?" é o tipo de mensagem que comumente aparece no grupo de WhatsApp da orquestra. O mesmo acontece com as aulas e outras atividades.

O maestro registra **eventos** (`Event`) na agenda da organização: ensaios, cultos, aulas, congressos e eventos especiais. Cada evento tem um **tipo** configurável (`EventType` — ex.: ensaio de sábado, culto de terça, culto de ceia), data e observações. Em cada evento, a **programação** (`ProgramItem`) lista as obras na ordem do culto ou ensaio.

Evento sem programação ainda é válido ("vai ter ensaio amanhã" só com data). Os itens de programação são a fonte do histórico de execução.

### Leitor de arquivos online e offline

Para os usuários, baixar PDFs das partituras importa, mas visualizar online é mais prático. Idealmente, arquivos ficam acessíveis offline para quem precisa consultar sem internet — aqui entra um PWA.

No MVP, "PDFs da minha parte" filtra arquivos ligados ao `Part` do assignment do músico, mais partitura geral quando a UI oferecer.

### Sistema responsivo para desktop, mobile e tablet

O sistema precisa funcionar bem em telas diversas. Existe a expectativa de que, no futuro, muitos músicos migrem das pastas de papel para tablets; este sistema pode ser o precursor disso se a responsividade for um ponto forte.

### Informação acionável e relatórios (Insights)

Diante de tanta atividade, o maestro quer saber quantas vezes certa música já foi tocada, quando foi a última vez, quantas obras entraram em cultos no trimestre, etc.

Essas respostas vêm de **Insights**: consulta sobre `ProgramItem` + `Event` + `Piece` (contagem e data da última execução, filtrável por tipo de evento e intervalo). No MVP, consulta simples na ficha da obra; relatórios visuais (semanal, mensal, anual, por naipe) usam os mesmos dados depois — escalas por naipe leem `Section` + `Assignment`.

A parte visual dos relatórios não precisa nascer com o sistema, mas os dados de programação e tipo de evento já entram no modelo desde o MVP.

### Multitenancy

O sistema não fica amarrado à Kairós. Cada **organização** (`Organization`) é um tenant isolado; um usuário pode pertencer a mais de uma. URLs e dados respeitam o contexto da organização corrente.

### Temas claro e escuro

Cada usuário escolhe `ThemePreference` (`light` ou `dark`) no próprio perfil. Vale em todas as organizações — não é configuração da org nem confunde com tema de obra (`PieceTheme`).

## Fora do núcleo (depois)

Itens do sonho original que o modelo já antecipa, mas que não entram no MVP:

- **Comunicação** (WhatsApp, e-mail) por músico, naipe ou chefe de naipe — canal à parte, dependendo de Identity + Ensemble.
- **Escalas detalhadas** por naipe, disponibilidade e turmas — evolução de `Assignment` + `Section` + `Event`.
- **Cadeira no assignment** ("você é trombone 1") — arquivos já usam `PartDivision`; o assignment aponta só para `Part` no MVP.
- **Relatórios visuais e exportação** — dados já existem; falta a camada de apresentação.
- **Offline completo de arquivos** — Dexie e cache por obra; no MVP, PWA instalável e shell em cache.

Detalhes em [`project-models.md`](project-models.md), seção 6.

## FUTURO

### Anotações em partituras

Após o leitor de PDF online/offline, evoluir o visualizador para um modo de performance em tablet, com anotações sobre a partitura sem alterar o PDF canônico da obra.

Casos de uso principais:
- **Camada de naipe** — o chefe de naipe (`section_lead`) marca arcadas e outras indicações para o naipe (ex.: cordas). Visível para todos do naipe; edição restrita ao chefe de naipe.
- **Camada pessoal** — cada músico anota detalhes de execução (dedilhado, dinâmica, lembretes do maestro no ensaio). Visível e editável apenas pelo autor.

Princípios de UX:
- Leitura primeiro: zoom, scroll e gestos nativos de tablet; anotações não bloqueiam a visualização.
- Ferramentas rápidas na barra inferior (arcada baixo/alto, texto, destaque); sem modais no ensaio.
- Toggle de camadas (minhas / naipe / todas) com cores distintas.
- Abrir a partitura pelo evento da agenda já com o PDF da parte do músico (via assignment).
- Offline-first: anotações pessoais e de naipe sincronizam quando a conexão retorna (PWA + cache local).

Implementação prevista: overlay (SVG) sobre o PDF renderizado com pdf.js; coordenadas normalizadas por página; persistência em camadas com permissões via RLS alinhadas aos papéis do Ensemble (`section_lead` vs `member`).

## Stack de tecnologia
- Frontend: React, Typescript, Vite, Tailwind
- PWA: Service Workers, Workbox, Dexie.js
- Backend/Infra: Supabase (Auth, PostgreSQL, RLS, Storage)
- Hosting: Vercel
