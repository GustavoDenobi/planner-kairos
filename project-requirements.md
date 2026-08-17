Estes são alguns requisitos e pontos de atenção que já quero deixar estabelecidos antes de iniciar a implementação, considerando experiências ruins que tive anteriormente.

# Criação de conta
- Deverá ser possível enviar links para criação de conta associados a group.
- A criação de conta já cria músico também.
- Cadastro nasce como member, nunca admin.
- O link deve ser válido por tempo determinado, e poderá ser excluído.
- Após criar conta por convite, usuário vai direto para org do convite.

# Login
- Usuário sem acesso vai direto para /login (a menos que seja página pública, como o link de convite)
- Ao acessar, vai para o seletor de org
- Mostra "sem acesso" se usuário não tiver nenhuma org
- Cada organização pode ter uma imagem configurada (`imageStorageKey`); o seletor exibe essa imagem como identificador visual ao lado do nome. Sem imagem, usa fallback com as iniciais do nome da org

# Recuperação de senha
- Deve haver uma página de recuperação de senha acessível a partir da tela de login
- A recuperação/alteração de senha será feita via OTP
- Não usaremos o OTP do Supabase (aprendi que não é confiável). Vamos ter um email para disparo de códigos de recuperação.

# Estrutura de navegação
- Barra lateral em desktop e tablet, navbar inferior + cabeçalho em mobile

# Estilos, cores e coesão visual:
- Não tenho uma preferência por paleta de cores, mas precisa ser definido a nível de projeto.
- Deverá ser criado e mantido um arquivo com definições sobre estilos para manter a coesão visual na aplicação conforme ela cresce.