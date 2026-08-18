import { useOnlineStatus } from './useOnlineStatus';

type OfflineBannerProps = {
  isCached?: boolean;
};

export function OfflineBanner({ isCached = false }: OfflineBannerProps) {
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <div
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
      role="status"
    >
      {isCached
        ? 'Sem conexão — lendo arquivos salvos no dispositivo.'
        : 'Sem conexão — alguns conteúdos podem não estar disponíveis.'}
    </div>
  );
}
