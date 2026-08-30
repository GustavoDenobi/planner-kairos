import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function TermsOfUsePage() {
  return (
    <article className="select-text rounded-xl border border-border bg-surface p-6 shadow-sm">
      <header>
        <h1 className="font-brand text-2xl font-bold text-text">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted">Última atualização: 25 de agosto de 2026</p>
      </header>

      <div className="mt-6">
        <Section title="1. Aceitação">
          <p>
            Ao criar uma conta, aceitar um convite, vincular seu cadastro de músico ou utilizar o{' '}
            <strong className="font-medium text-text">Planner Musical</strong>, você declara ter lido,
            compreendido e concordado com estes Termos de Uso e com a nossa{' '}
            <Link to="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
            . Se você não concorda com qualquer disposição, não utilize o serviço.
          </p>
          <p>
            O uso da plataforma por organizações também pode estar sujeito a acordos comerciais ou
            condições específicas acordadas com a operadora; em caso de conflito entre acordo
            específico e estes Termos, prevalece o acordo específico naquilo que divergir.
          </p>
        </Section>

        <Section title="2. Operadora e descrição do serviço">
          <p>
            O Planner Musical é desenvolvido e operado por{' '}
            <strong className="font-medium text-text">d9 Digital</strong>, que disponibiliza a
            infraestrutura técnica da plataforma.
          </p>
          <p>
            O serviço é uma plataforma online para gestão de repertório, agenda, grupos e cadastro de
            músicos em organizações musicais. Pode ser acessado pelo navegador ou como aplicativo
            instalável (PWA), inclusive com funcionalidades de uso offline para conteúdo já
            disponibilizado ao usuário.
          </p>
          <p>
            Cada organização utiliza a plataforma para gerir sua própria atividade musical. A d9
            Digital não é parte das relações entre organizações e seus membros, músicos ou terceiros,
            exceto na qualidade de provedora da tecnologia.
          </p>
        </Section>

        <Section title="3. Elegibilidade e cadastro">
          <p>
            Para utilizar o serviço, você deve ter capacidade legal para contratar ou utilizar
            serviços digitais. Se você é menor de 12 anos, o uso deve ocorrer com consentimento e
            supervisão de responsável legal, conforme aplicável.
          </p>
          <p>
            Você é responsável por fornecer informações verdadeiras, completas e atualizadas no
            cadastro e por manter a confidencialidade da sua senha. Todas as atividades realizadas na
            sua conta são de sua responsabilidade até que você notifique a operadora ou o administrador
            da organização sobre uso não autorizado e tome medidas para proteger o acesso.
          </p>
          <p>
            O cadastro é pessoal e intransferível. Não crie conta para terceiros sem autorização nem
            utilize identidade falsa.
          </p>
        </Section>

        <Section title="4. Uso permitido e condutas proibidas">
          <p>
            Você concorda em utilizar o serviço apenas para fins legítimos relacionados à atividade
            musical da organização à qual está vinculado, respeitando a legislação aplicável, estes
            Termos e as regras da organização.
          </p>
          <p>É vedado, sem limitação:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>violar leis, regulamentos ou direitos de terceiros, inclusive de privacidade e
              propriedade intelectual;</li>
            <li>tentar acessar, copiar ou modificar dados de outras organizações ou de usuários sem
              permissão;</li>
            <li>interferir no funcionamento, na segurança ou na disponibilidade da plataforma,
              inclusive por engenharia reversa, exploração de vulnerabilidades, uso de bots ou
              automação não autorizada;</li>
            <li>distribuir, publicar ou armazenar conteúdo ilegal, difamatório, discriminatório,
              violento ou que viole direitos autorais sem autorização;</li>
            <li>utilizar o serviço para spam, phishing, disseminação de malware ou qualquer forma de
              abuso;</li>
            <li>contornar mecanismos de autenticação, permissões ou isolamento entre organizações.</li>
          </ul>
        </Section>

        <Section title="5. Conteúdo das organizações e dos usuários">
          <p>
            Partituras, anotações, dados de músicos, imagens, textos e demais conteúdos inseridos por
            organizações ou usuários permanecem sob responsabilidade de quem os cadastra ou publica.
            A organização e os usuários que inserem conteúdo garantem ter os direitos necessários
            para utilizá-lo e licenciá-lo na plataforma.
          </p>
          <p>
            O Planner Musical fornece infraestrutura para armazenamento, organização e exibição desse
            conteúdo conforme as permissões definidas por cada organização. A d9 Digital não endossa
            nem se responsabiliza pelo conteúdo inserido por terceiros, mas pode remover material ou
            suspender acessos quando houver violação destes Termos, ordem legal ou solicitação
            fundamentada de titular de direitos.
          </p>
        </Section>

        <Section title="6. Regras da organização">
          <p>
            Cada organização pode publicar regulamentos próprios no sistema. Ao aceitar um convite,
            vincular seu cadastro de músico ou utilizar recursos que exijam ciência dessas regras, você
            também concorda com as disposições específicas da organização, quando aplicável.
          </p>
          <p>
            Questões internas de gestão, disciplina, participação em eventos ou uso de materiais da
            organização devem ser dirimidas prioritariamente com os administradores da organização.
          </p>
        </Section>

        <Section title="7. Licença de uso da plataforma">
          <p>
            Sujeito a estes Termos, a d9 Digital concede a você licença limitada, revogável, não
            exclusiva e intransferível para acessar e utilizar o Planner Musical para os fins
            previstos no serviço. Essa licença não implica cessão de qualquer direito sobre o software,
            marca, layout, código ou demais elementos da plataforma.
          </p>
          <p>
            Você não pode copiar, modificar, distribuir, sublicenciar ou criar obras derivadas da
            plataforma, exceto quando expressamente permitido por lei ou por autorização escrita da
            operadora.
          </p>
        </Section>

        <Section title="8. Propriedade intelectual da plataforma">
          <p>
            O nome Planner Musical, logotipos, interface, software e demais elementos proprietários da
            plataforma são de titularidade da d9 Digital ou de seus licenciantes, protegidos pelas leis
            de propriedade intelectual. O uso indevido desses elementos é proibido.
          </p>
        </Section>

        <Section title="9. Serviços de terceiros">
          <p>
            O serviço pode depender de provedores de infraestrutura em nuvem, hospedagem, entrega de
            e-mail e outros serviços técnicos. O aplicativo também pode carregar recursos de terceiros,
            como fontes tipográficas de Google Fonts, sujeitos às políticas dos respectivos provedores.
          </p>
          <p>
            A d9 Digital não controla serviços de terceiros e não se responsabiliza por indisponibilidades,
            alterações ou práticas desses provedores, dentro dos limites legais.
          </p>
        </Section>

        <Section title="10. Disponibilidade, alterações e suporte">
          <p>
            Buscamos manter o serviço disponível e seguro, mas não garantimos funcionamento ininterrupto,
            livre de erros ou compatível com todos os dispositivos ou navegadores. Manutenções,
            atualizações, falhas de rede ou eventos fora do nosso controle razoável podem afetar o
            acesso.
          </p>
          <p>
            Podemos adicionar, modificar ou remover funcionalidades, corrigir problemas ou atualizar
            estes Termos. Alterações relevantes serão comunicadas por meio do aplicativo ou por outros
            canais adequados. O uso continuado após a publicação de nova versão constitui ciência das
            alterações, quando aplicável.
          </p>
        </Section>

        <Section title="11. Suspensão e encerramento">
          <p>
            Podemos suspender ou encerrar o acesso à plataforma, com ou sem aviso prévio, em caso de
            violação destes Termos, risco à segurança, solicitação da organização, exigência legal ou
            encerramento do serviço. Organizações podem revogar o acesso de membros conforme suas
            políticas internas e permissões do sistema.
          </p>
          <p>
            Você pode solicitar o encerramento da sua conta pelos canais disponíveis na plataforma ou
            junto ao administrador da organização. Após o encerramento, dados podem ser mantidos ou
            eliminados conforme a Política de Privacidade, obrigações legais e configurações da
            organização.
          </p>
        </Section>

        <Section title="12. Privacidade e dados">
          <p>
            O tratamento de dados pessoais é descrito na{' '}
            <Link to="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
            . O uso do serviço implica ciência de que determinados dados são processados para operar a
            plataforma, inclusive em servidores de provedores de infraestrutura e, quando habilitado,
            em armazenamento local do seu dispositivo para uso offline.
          </p>
        </Section>

        <Section title="13. Exclusão de garantias">
          <p>
            O serviço é fornecido &quot;como está&quot; e &quot;conforme disponível&quot;, dentro dos
            limites permitidos pela legislação aplicável. A d9 Digital não garante que o serviço
            atenderá a todas as expectativas, necessidades específicas ou resultados desejados pela
            organização ou pelos usuários.
          </p>
        </Section>

        <Section title="14. Limitação de responsabilidade">
          <p>
            Na máxima extensão permitida por lei, a d9 Digital não se responsabiliza por perdas
            indiretas, lucros cessantes, perda de dados não atribuíveis a falha exclusiva da operadora,
            interrupções de conexão, falhas de dispositivos de terceiros ou conteúdo inserido por
            usuários, organizações ou terceiros.
          </p>
          <p>
            Quando a responsabilidade não possa ser limitada por lei, ela ficará restrita aos danos
            diretos comprovadamente causados por culpa exclusiva da d9 Digital, observando-se os
            limites legais aplicáveis, inclusive às normas de proteção ao consumidor quando couberem.
          </p>
        </Section>

        <Section title="15. Indenização">
          <p>
            Você concorda em indenizar e manter indene a d9 Digital, suas controladoras, coligadas e
            prestadores de serviço, em relação a reclamações, perdas e despesas (inclusive honorários
            advocatícios razoáveis) decorrentes do uso indevido do serviço por você, do conteúdo que
            você inserir ou da violação destes Termos ou de direitos de terceiros, dentro dos limites
            legais aplicáveis.
          </p>
        </Section>

        <Section title="16. Legislação aplicável e foro">
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil, incluindo, quando
            aplicável, a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e o Marco Civil da
            Internet (Lei nº 12.965/2014).
          </p>
          <p>
            Fica eleito o foro da comarca de Apucarana - PR para dirimir controvérsias decorrentes
            destes Termos, salvo disposição legal específica que estabeleça foro diverso, inclusive em
            relação a consumidores.
          </p>
        </Section>

        <Section title="17. Disposições gerais">
        <ul className="list-disc space-y-1 pl-5">
            <li>A invalidade ou inexequibilidade de qualquer cláusula não afeta as demais;</li>
            <li>A tolerância a eventual descumprimento não constitui renúncia de direito;</li>
            <li>Estes Termos, em conjunto com a Política de Privacidade e as regras da organização quando aplicáveis, constituem o acordo integral entre você e a d9 Digital quanto ao uso da plataforma.</li>
          </ul>
        </Section>

        <Section title="18. Contato">
          <p>
            Dúvidas sobre estes Termos, o funcionamento da plataforma ou solicitações relacionadas ao
            serviço podem ser encaminhadas à d9 Digital pelo e-mail{' '}
            <a
              href="mailto:contato@d9digital.com"
              className="text-primary hover:underline"
            >
              contato@d9digital.com
            </a>
            .
          </p>
          <p>
            Para questões sobre dados cadastrados pela sua organização ou sobre regras internas de
            participação, o primeiro ponto de contato é o administrador da organização à qual você está
            vinculado.
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
