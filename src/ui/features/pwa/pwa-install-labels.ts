import type { PwaInstallContextKind } from '@/ui/features/pwa/detect-pwa-install-context';

export type PwaInstallCopy = {
  title: string;
  description: string;
  steps: string[];
  primaryCta: string;
  secondaryCta: string;
};

const SHARED_SECONDARY = 'Agora não';

const COPY_BY_KIND: Record<Exclude<PwaInstallContextKind, 'installed' | 'unsupported'>, PwaInstallCopy> = {
  native: {
    title: 'Instalar o app',
    description: 'Instale o Planner Musical neste dispositivo para abrir mais rápido e usar partituras offline.',
    steps: ['Toque em Instalar agora e confirme no navegador.'],
    primaryCta: 'Instalar agora',
    secondaryCta: SHARED_SECONDARY,
  },
  'ios-safari': {
    title: 'Instalar na tela de início',
    description: 'No iPhone ou iPad, o app é adicionado pela opção de compartilhar do Safari.',
    steps: [
      'Toque no botão de compartilhar (quadrado com seta para cima) na barra do Safari.',
      'Role e toque em “Adicionar à Tela de Início”.',
      'Confirme em “Adicionar”.',
    ],
    primaryCta: 'Entendi',
    secondaryCta: SHARED_SECONDARY,
  },
  'mac-safari': {
    title: 'Adicionar ao Dock',
    description: 'No Safari do Mac, o app pode ser instalado como um atalho no Dock.',
    steps: [
      'Clique no botão de compartilhar na barra de ferramentas do Safari.',
      'Escolha “Adicionar ao Dock”.',
      'Confirme a instalação.',
    ],
    primaryCta: 'Entendi',
    secondaryCta: SHARED_SECONDARY,
  },
  'android-manual': {
    title: 'Instalar o app',
    description: 'Adicione o Planner Musical à tela inicial para abri-lo como um aplicativo.',
    steps: [
      'Abra o menu do navegador (três pontos).',
      'Toque em “Instalar app” ou “Adicionar à tela inicial”.',
      'Confirme a instalação.',
    ],
    primaryCta: 'Entendi',
    secondaryCta: SHARED_SECONDARY,
  },
  'desktop-chrome': {
    title: 'Instalar o app',
    description: 'Instale o Planner Musical pelo navegador para abrir em uma janela própria.',
    steps: [
      'Clique no ícone de instalação na barra de endereço.',
      'Confirme em “Instalar”.',
    ],
    primaryCta: 'Entendi',
    secondaryCta: SHARED_SECONDARY,
  },
  'samsung-internet': {
    title: 'Instalar o app',
    description:
      'No Samsung Internet, a instalação pode mostrar o aviso "App de risco bloqueado". O app é seguro! A mensagem é uma limitação deste navegador.',
    steps: [
      'Toque em "Instalar agora" e confirme no navegador.',
      'Se aparecer "App de risco bloqueado", toque em "Mais detalhes" e depois em "Instalar assim mesmo".',
      'Alternativa: abra planner.d9digital.com no Google Chrome e instale o app por lá.',
    ],
    primaryCta: 'Instalar agora',
    secondaryCta: SHARED_SECONDARY,
  },
  'in-app-browser': {
    title: 'Abra no navegador',
    description:
      'Este navegador interno não permite instalar o app. Abra o Planner Musical no Safari ou no Chrome para continuar.',
    steps: [
      'Toque no menu do aplicativo (⋯ ou "Abrir no navegador").',
      'Abra o link no Safari ou no Chrome.',
      'Siga as instruções para instalar o app.',
    ],
    primaryCta: 'Entendi',
    secondaryCta: SHARED_SECONDARY,
  },
};

export function getPwaInstallCopy(kind: PwaInstallContextKind): PwaInstallCopy | null {
  if (kind === 'installed' || kind === 'unsupported') {
    return null;
  }
  return COPY_BY_KIND[kind];
}

export const PWA_INSTALL_BANNER_LABEL = 'Instalar o app';
export const PWA_INSTALL_BANNER_HINT = 'Acesso rápido e offline';
export const PWA_INSTALL_BANNER_HINT_SAMSUNG = 'Pode aparecer aviso de segurança do navegador';

export function getPwaInstallBannerHint(kind: PwaInstallContextKind): string {
  return kind === 'samsung-internet' ? PWA_INSTALL_BANNER_HINT_SAMSUNG : PWA_INSTALL_BANNER_HINT;
}
