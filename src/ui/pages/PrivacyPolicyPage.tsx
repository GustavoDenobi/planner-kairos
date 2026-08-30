import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <article className="select-text rounded-xl border border-border bg-surface p-6 shadow-sm">
      <header>
        <h1 className="font-brand text-2xl font-bold text-text">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted">Última atualização: 25 de agosto de 2026</p>
      </header>

      <div className="mt-6">
        <Section title="1. Sobre o serviço">
          <p>
            O <strong className="font-medium text-text">Planner Musical</strong> é uma plataforma de
            gestão de repertório e agenda para organizações musicais. Esta política descreve como
            tratamos dados pessoais quando você utiliza o aplicativo, o site ou a versão instalável
            (PWA).
          </p>
        </Section>

        <Section title="2. Quem é responsável pelos dados">
          <p>
            O tratamento de dados ocorre no contexto da organização à qual você está vinculado (igreja,
            orquestra, grupo musical etc.). A organização define quais informações cadastra sobre
            músicos, eventos e repertório. A infraestrutura técnica do serviço é operada em nome das
            organizações que utilizam a plataforma.
          </p>
          <p>
            Para questões sobre dados cadastrados pela sua organização (nome, telefone, CPF, partes
            instrumentais etc.), o primeiro ponto de contato é o administrador da organização.
          </p>
        </Section>

        <Section title="3. Dados que podemos tratar">
          <p>Dependendo de como você usa o serviço, podemos tratar:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="font-medium text-text">Dados de conta:</strong> nome de exibição,
              e-mail e senha (armazenada de forma criptografada).
            </li>
            <li>
              <strong className="font-medium text-text">Dados de perfil e vínculo:</strong>{' '}
              participação em organizações, grupos e papéis (por exemplo, administrador ou músico).
            </li>
            <li>
              <strong className="font-medium text-text">Dados de músicos:</strong> nome completo,
              data de nascimento, telefone, e-mail, CPF e observações, quando informados pela
              organização ou no cadastro via convite ou vínculo de músico.
            </li>
            <li>
              <strong className="font-medium text-text">Conteúdo da organização:</strong> agenda,
              eventos, repertório, partituras (PDF), anotações em partituras, playlists de leitura e
              imagens de identidade visual da organização.
            </li>
            <li>
              <strong className="font-medium text-text">Dados técnicos mínimos:</strong> registros
              necessários para autenticação, segurança e funcionamento do serviço.
            </li>
          </ul>
        </Section>

        <Section title="4. Finalidades e bases legais">
          <p>Utilizamos os dados para:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>criar e gerenciar contas de acesso;</li>
            <li>permitir convites, cadastros e vínculo de músicos às organizações;</li>
            <li>exibir agenda, repertório e materiais de leitura;</li>
            <li>recuperação de senha por e-mail;</li>
            <li>habilitar uso offline (cache local de arquivos e dados já acessados);</li>
            <li>manter preferências de exibição (tema claro/escuro, escala da interface).</li>
          </ul>
          <p>
            O tratamento baseia-se, conforme o caso, na execução de contrato ou de procedimentos
            preliminares, no legítimo interesse da organização em gerir sua atividade musical, no
            consentimento (quando aplicável) e no cumprimento de obrigações legais, nos termos da Lei
            Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
          </p>
        </Section>

        <Section title="5. Armazenamento no seu dispositivo">
          <p>
            O Planner Musical <strong className="font-medium text-text">não utiliza cookies de
            rastreamento ou publicidade</strong>. Para funcionar, o aplicativo pode armazenar
            informações no seu navegador ou dispositivo:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="font-medium text-text">Sessão de login:</strong> token de
              autenticação em armazenamento local do navegador, para mantê-lo conectado.
            </li>
            <li>
              <strong className="font-medium text-text">Preferências:</strong> tema, escala da
              interface, organização selecionada e filtros de telas.
            </li>
            <li>
              <strong className="font-medium text-text">Modo offline:</strong> arquivos e dados em
              banco local (IndexedDB) e cache via service worker, para leitura de partituras e uso
              sem conexão.
            </li>
          </ul>
          <p>
            Esses armazenamentos são necessários para o funcionamento do serviço. Você pode removê-los
            limpando os dados do site no navegador ou desinstalando o aplicativo; isso pode encerrar
            sua sessão e apagar conteúdo salvo offline no dispositivo.
          </p>
        </Section>

        <Section title="6. Compartilhamento e operadores">
          <p>
            Os dados são armazenados em servidores gerenciados por provedores de infraestrutura em nuvem
            utilizados para hospedar o aplicativo e o banco de dados.
            Esses provedores processam dados apenas para operar o serviço, sob obrigações contratuais
            de confidencialidade e segurança.
          </p>
          <p>
            Dentro de cada organização, administradores e usuários autorizados podem acessar os dados
            conforme as permissões do sistema. Não vendemos dados pessoais.
          </p>
          <p>
            O aplicativo pode carregar fontes tipográficas de servidores do Google Fonts. Essas
            requisições seguem as políticas do respectivo provedor.
          </p>
        </Section>

        <Section title="7. Retenção">
          <p>
            Mantemos os dados enquanto sua conta estiver ativa e enquanto forem necessários às
            finalidades descritas, inclusive para cumprimento de obrigações legais. Dados mantidos
            apenas no seu dispositivo (cache offline) permanecem até você limpá-los ou desinstalar o
            aplicativo.
          </p>
        </Section>

        <Section title="8. Seus direitos">
          <p>
            Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção,
            anonimização, portabilidade, eliminação de dados tratados com consentimento, informação
            sobre compartilhamento e revogação de consentimento, quando aplicável.
          </p>
          <p>
            Para exercer esses direitos em relação a dados da sua organização, entre em contato com o
            administrador responsável. Para questões sobre o funcionamento da plataforma, utilize o
            canal de suporte disponibilizado pelo provedor do serviço.
          </p>
        </Section>

        <Section title="9. Segurança">
          <p>
            Adotamos medidas técnicas e organizacionais para proteger os dados, como controle de
            acesso por organização, autenticação segura e isolamento de dados entre organizações. Nenhum
            sistema é totalmente imune a riscos; recomendamos o uso de senhas fortes e a proteção do
            seu dispositivo.
          </p>
        </Section>

        <Section title="10. Alterações nesta política">
          <p>
            Podemos atualizar esta política para refletir mudanças no serviço ou na legislação. A data
            da última atualização será indicada no topo desta página. O uso continuado do serviço após
            alterações relevantes pode ser considerado como ciência da nova versão, conforme
            comunicado no aplicativo quando apropriado.
          </p>
        </Section>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        <Link to="/login" className="text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </article>
  );
}
