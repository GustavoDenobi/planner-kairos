# Planner Kairós — Visão estratégica (uso interno)

> Documento interno de referência para o go-to-market. Resume o que o produto é, para quem, o que já entrega, como pode ser monetizado e o que falta para a comercialização.
> Detalhes técnicos: [`DEVELOPMENT.md`](DEVELOPMENT.md). Origem e modelo de domínio: [`project-overview.md`](project-overview.md) e [`project-models.md`](project-models.md).
>
> Os itens marcados como **hipótese** ainda precisam ser validados com clientes.

---

## 1. Resumo

O Planner Kairós é um **SaaS multi-organização para gestão de grupos musicais**. Ele junta em um só lugar o **repertório** (partituras em PDF e áudios por parte), a **agenda** (ensaios, apresentações e aulas, cada um com sua programação), o **cadastro do grupo** (músicos, formações, naipes e partes) e um **leitor de partituras para tablet** com anotações, playlists e uso offline.

**Problema que resolve:** grupos musicais funcionam hoje com pastas de partituras soltas, grupos de WhatsApp ("vai ter ensaio amanhã?") e anotações pessoais do regente para lembrar o que já foi tocado. Quem guarda o acervo (geralmente o próprio maestro) vira um gargalo, e o histórico do grupo se perde.

**Proposta de valor em uma frase:** *o acervo, a agenda e as partituras do seu grupo organizados e acessíveis a cada músico na parte certa, do ensaio ao palco.*

---

## 2. Origem e caso âncora

- O projeto nasceu na **Orquestra Kairós** (Assembleia de Deus, Apucarana-PR): mais de 60 músicos titulares, dezenas de alunos, vários professores, pelo menos um culto por semana, ensaios e eventos especiais (congressos, simpósios, cantatas).
- O acervo tem quase 30 anos, com PDFs por parte ou cadeira e áudios em MP3/WAV.
- A dor que deu origem ao produto: o maestro anotava num bloco de notas do tablet o repertório de cada culto, para não repetir músicas e escolher por tema.
- **Status:** o produto está em uso real nesse grupo, que serve de **caso de referência, fonte de depoimentos e laboratório de produto**.

---

## 3. Mercado e segmentos

### Segmentos-alvo (ordem sugerida de prioridade — hipótese)

| # | Segmento | Por que encaixa | Observações |
|---|----------|-----------------|-------------|
| 1 | **Orquestras, bandas e corais de igrejas** (evangélicas em especial) | É o caso de origem. Agenda semanal fixa (cultos), repertório temático (Ceia, Natal, congressos), muitos alunos e alta rotatividade de músicos | Canal forte por indicação entre igrejas e denominações. O vocabulário do produto já é neutro, mas o seed de categorias e tipos de evento veio desse contexto |
| 2 | **Escolas de música, conservatórios e projetos sociais** | Turmas, professores, distribuição de material por instrumento, tarefas de estudo com gravação | O módulo de tarefas de estudo (professor → aluno) é um diferencial aqui |
| 3 | **Bandas sinfônicas, marciais e filarmônicas municipais** | Acervo grande dividido por parte, muitos naipes | Ciclos de compra mais institucionais (prefeituras, associações) |
| 4 | **Big bands, corais independentes e grupos de câmara** | Menores e mais ágeis, usam tablet no palco | Tíquete menor, provável porta de entrada no self-service |

### Perfis dentro da organização

| Perfil | Papel na compra | Principal ganho |
|--------|-----------------|-----------------|
| **Regente / maestro / coordenador** | **Decisor e campeão interno** | Histórico de execução, planejamento de repertório, fim do "arquivista humano" |
| **Secretaria / liderança administrativa** | Influenciador e operador | Cadastro de músicos, convites, aniversários, agenda centralizada |
| **Chefe de naipe / professor** | Usuário avançado | Anotações para o naipe ou para alunos, tarefas de estudo |
| **Músico / aluno** | Usuário final (adoção) | Partitura da sua parte no tablet ou celular, agenda, ferramentas de estudo |

> **Implicação para o GTM:** o comprador é o regente ou a liderança, mas o sucesso depende de os músicos adotarem o app. Onboarding sem atrito (convite por link, login com Google, PWA) é parte da estratégia, não detalhe.

---

## 4. Produto: o que já está entregue

### 4.1 Núcleo (pronto e em uso)

| Módulo | Capacidades | Valor para o cliente |
|--------|-------------|----------------------|
| **Repertório** | Obras com compositor, notas, categoria e temas configuráveis; PDFs e áudios ligados a partes e divisões (ex.: trombone 1+2, SATB, grade); busca, filtros e ordenação; transposição padrão por parte | Acervo digital pesquisável, cada músico recebe só a parte dele |
| **Agenda** | Tipos de evento configuráveis (nome e cor); visão semanal e kanban; recorrência com edição "só este / deste em diante"; cancelamento; audiência por evento; aniversários | Substitui o "vai ter ensaio?" no WhatsApp |
| **Programação e histórico** | Obras em ordem por evento, marcação do que foi executado, ausências; histórico por obra e por músico | **Diferencial central:** responde "quando tocamos isso pela última vez?" |
| **Ensemble** | Músicos (com ou sem login), formações, naipes, partes, divisões e atribuições com papel musical (integrante, professor, chefe de naipe, regente) | Modela grupos reais e complexos, inclusive o mesmo músico em várias formações |
| **Onboarding** | Convite por link para uma formação; reivindicação de cadastro por link seguro; login com e-mail/senha ou Google; recuperação de senha por código | Baixa fricção para trazer dezenas de músicos |

### 4.2 Leitor de partituras (diferencial de experiência)

- Leitor de PDF otimizado para tablet: sumário (TOC), atalhos de navegação e pulos (voltas, D.S., coda), laser, player de áudio integrado e afinador dentro do próprio leitor.
- **Anotações em camadas**, sem alterar o PDF original:
  - **Pessoal**: só o autor vê.
  - **Naipe**: o chefe de naipe escreve e o naipe inteiro vê (arcadas, respirações).
  - **Direcionada**: o regente ou professor escreve para grupos ou músicos específicos.
  - Ferramentas disponíveis: caneta, destaque, texto, notas, cobertura, borracha e retângulo.
- **Playlists de leitura**: ordem das partituras de um ensaio ou concerto, leitura em sequência, vínculo com eventos, "preparar partituras" e cache offline.

### 4.3 Estudo e pedagogia

- **Ferramentas**: afinador (referência por parte ou instrumento), metrônomo, cronômetro e gravador de estudo.
- **Tarefas de estudo** (recém-entregue): professor ou regente pede uma gravação com prazo, apontando para a obra, o arquivo ou o trecho exato (página ou item do sumário). O aluno grava e envia pelo app, inclusive fora do prazo, com status de entrega.

### 4.4 Plataforma

- **Multi-organização**: cada org é um tenant isolado, e o usuário alterna entre várias com a mesma conta.
- **PWA instalável** com uso offline parcial (agenda, leitura, músicos, ferramentas).
- Responsivo: desktop, tablet e celular. Tema claro ou escuro por usuário.
- Identidade visual da org (logo) no seletor, nos convites e nos previews de links compartilhados (OG).
- **Termos de uso, política de privacidade e regulamento da org** com aceite registrado (base para LGPD).
- Painel de **admin da plataforma**: organizações, usuários e planos.

---

## 5. Diferenciais competitivos

1. **Histórico de execução ligado à agenda**: poucos concorrentes ligam "o que tocamos" a "quando e em que tipo de evento". É a dor original do cliente âncora.
2. **Partitura certa para o músico certo**: arquivos ligados a partes e divisões, filtrados pela atribuição do músico.
3. **Anotações em camadas com hierarquia musical** (pessoal, naipe, direcionada), refletindo os papéis reais do grupo.
4. **Tudo em um**: agenda, acervo, leitor, ferramentas de estudo e tarefas, onde hoje se usam vários apps (forScore/MobileSheets, Google Drive, WhatsApp, planilhas).
5. **Feito para a realidade brasileira**: em português, com grupos de igreja e escolas como primeiro público, login com Google e uso offline para locais com internet ruim.
6. **Multi-org nativo**: o músico que toca na igreja e na escola usa uma conta só, o que gera efeito de rede entre organizações.

### Alternativas que o cliente usa hoje (mapear em detalhe — pendente)

- **Status quo**: WhatsApp + Google Drive/Dropbox + pastas de papel + planilha ou bloco de notas.
- **Leitores de partitura** (forScore, MobileSheets, Newzik): bons na leitura individual, fracos em gestão de grupo e agenda.
- **Gestão de grupos e escalas** (ex.: Planning Center, apps de escala de louvor): fortes em escala de voluntários, fracos em acervo de partituras por parte.
- **Bibliotecas digitais para orquestras e bandas**: em geral caras, em inglês e pensadas para instituições grandes.

---

## 6. Modelo de negócio

### 6.1 O que já existe no sistema

- Entidade **Plano** com limites por organização: **formações, músicos, obras e armazenamento**. Cada org tem um plano ativo, e os limites são verificados no backend.
- Plano seed: **Gratuito**, com 10 formações, 100 músicos, 500 obras e 1 GB.
- Administradores da org veem o **plano ativo e o uso atual** na configuração.
- O admin da plataforma cria e edita planos e define o plano de cada org.
- **Cobrança manual via Pix** (`/admin/cobranca`): valor, ciclo (mensal a anual), vencimento e carência por org; registro de pagamentos, anotações e histórico de trocas de plano. O sistema só calcula a situação (em dia, vence em breve, carência, em atraso) e avisa; o rebaixamento é manual. Os admins da org veem valor, vencimento, chave Pix e os últimos pagamentos nas configurações.

### 6.2 O que ainda não existe

- **Cobrança automática**: não há gateway de pagamento integrado (Stripe, Asaas, Mercado Pago etc.). A cobrança é manual via Pix, e a troca de plano é feita pelo admin.
- Trial com prazo, upgrade/downgrade self-service, notas fiscais e dunning.

### 6.3 Estrutura de planos sugerida (hipótese, a validar)

| Plano | Público | Limites ou eixos de valor |
|-------|---------|---------------------------|
| **Gratuito** | Grupos pequenos, porta de entrada | Limites atuais (revisar: 100 músicos e 500 obras pode ser generoso demais para converter) |
| **Grupo** | Uma orquestra, banda ou coral | Mais obras e armazenamento, anotações de naipe e direcionadas, playlists offline |
| **Instituição** | Igrejas com vários grupos, escolas | Várias formações, tarefas de estudo, relatórios, suporte na migração do acervo |

**Métricas de valor candidatas:** armazenamento (o acervo em PDF/áudio cresce rápido), número de músicos ativos e formações. O armazenamento é o limite com custo real de infraestrutura (Supabase Storage).

**Serviço de implantação (hipótese):** digitalizar e catalogar o acervo é a maior barreira de entrada. Um serviço pago ou subsidiado de migração do acervo pode destravar contas grandes.

---

## 7. Canais e estratégia de entrada (hipótese)

- **Indicação entre igrejas e denominações**, a partir do caso Kairós (regentes se conhecem em congressos e encontros regionais).
- **Professores e escolas de música**: o professor que usa com alunos leva o app para outros grupos (efeito multi-org).
- **Conteúdo e comunidade**: "como organizar o acervo da sua orquestra", vídeos do leitor no tablet, depoimento do maestro.
- **Loop viral embutido no produto**: convites por link com preview da marca da org, link de reivindicação de perfil e músicos que pertencem a várias orgs.

---

## 8. Métricas sugeridas

| Fase do funil | Métrica |
|---------------|---------|
| Ativação da org | Obras cadastradas, eventos com programação e músicos convidados nos primeiros 14 dias |
| Adoção dos músicos | % de músicos cadastrados com login ativo; aberturas do leitor por semana |
| Hábito | Eventos por semana com programação preenchida; uso de playlists |
| Expansão | Orgs perto dos limites do plano (armazenamento, músicos) |
| Retenção | Orgs ativas mês a mês; músicos ativos por org |

> Hoje não há instrumentação de analytics de produto. Os números acima podem sair, em parte, de consultas ao banco, mas é preciso definir uma ferramenta.

---

## 9. Lacunas para a comercialização

| Área | Lacuna | Impacto no GTM |
|------|--------|----------------|
| Monetização | Gateway de pagamento, trial, upgrade self-service | Bloqueia a venda escalável |
| Onboarding da org | Criação de org self-service guiada, importação em massa de músicos e partituras | Hoje a implantação depende de esforço manual |
| Relatórios | Relatórios visuais e exportação (semanal, mensal, anual, por naipe); os dados já existem | Pedido original do cliente âncora, forte argumento de venda para o regente |
| Comunicação | Avisos por naipe, WhatsApp e e-mail | Era parte do "sonho" original; hoje o grupo de WhatsApp continua necessário |
| Escalas | Escala detalhada por naipe e disponibilidade | Muito relevante para igrejas |
| Offline | Offline completo de todos os arquivos (hoje é parcial, por playlist) | Importante para o palco e locais sem sinal |
| Analytics | Instrumentação de uso | Necessária para as métricas da seção 8 |
| Marketing | Landing page, materiais de demonstração, org de demo | Pré-requisito para aquisição |
| Idioma | Somente pt-BR | Ok para o mercado inicial; limita a expansão |

---

## 10. Base técnica (resumo para decisões de negócio)

- **Stack**: React 19 + TypeScript + Vite + Tailwind (frontend/PWA), Supabase (Auth, PostgreSQL com RLS, Storage, Edge Functions) e Vercel (hosting e funções de convite/OG).
- **Isolamento por organização** aplicado no banco (Row Level Security), o que é base para vender a instituições.
- **Arquivos privados**: partituras não ficam em URLs públicas permanentes; o acesso usa links assinados conforme a permissão.
- **Custos variáveis principais**: armazenamento e tráfego de PDFs e áudios (Supabase Storage), e-mail transacional (SMTP) e hosting (Vercel).
- Rate limiting nas ações de autenticação.

---

## 11. Próximos passos do GTM (rascunho)

1. Validar segmentos e disposição a pagar com 5 a 10 regentes ou coordenadores (igrejas e escolas).
2. Fechar a estrutura de planos e o preço; revisar os limites do plano Gratuito.
3. Integrar o gateway de pagamento e o fluxo de trial.
4. Montar uma org de demonstração e materiais (vídeo do leitor no tablet, case da Orquestra Kairós).
5. Definir o processo de onboarding e migração do acervo para as primeiras contas pagas.
6. Instrumentar métricas de ativação e adoção.
