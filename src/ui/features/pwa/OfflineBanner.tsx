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
      className="shrink-0 border-b border-amber-200 bg-amber-50 py-2 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
      style={{
        paddingLeft: 'max(1rem, var(--safe-area-left))',
        paddingRight: 'max(1rem, var(--safe-area-right))',
      }}
      role="status"
    >
      {isCached
        ? 'Sem conexão. Lendo arquivos salvos no dispositivo.'
        : 'Sem conexão. Alguns conteúdos podem não estar disponíveis.'}
    </div>
  );
}
