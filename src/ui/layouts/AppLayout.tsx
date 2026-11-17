import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useLoadingBarPlacement } from '@/ui/app/loading-bar/useLoadingBar';
import { OfflineUnavailableMessage } from '@/ui/features/pwa/OfflineUnavailableMessage';
import { OfflineBanner } from '@/ui/features/pwa/OfflineBanner';
import { PwaInstallMobileBanner } from '@/ui/features/pwa/PwaInstallMobileBanner';
import { usePwaInstallContext } from '@/ui/features/pwa/PwaInstallContext';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { BottomNav } from '@/ui/layouts/BottomNav';
import { MobileHeader } from '@/ui/layouts/MobileHeader';
import { Sidebar } from '@/ui/layouts/Sidebar';
import { spacing } from '@/ui/theme/tokens';

function isOfflineAllowedPath(pathname: string): boolean {
  if (pathname.includes('/leitura')) {
    return true;
  }
  if (pathname.includes('/agenda')) {
    return true;
  }
  if (pathname.includes('/eventos/') && !pathname.includes('/preparar-partituras')) {
    return true;
  }
  if (pathname.includes('/musicos')) {
    return true;
  }
  if (pathname.includes('/grupos')) {
    return true;
  }
  if (pathname.includes('/ferramentas')) {
    return true;
  }
  return false;
}

export function AppLayout() {
  const { orgSlug = 'org' } = useParams();
  useLoadingBarPlacement('belowAppHeader');
  const online = useOnlineStatus();
  const location = useLocation();
  const { visible: showInstallBanner } = usePwaInstallContext();
  const showOfflineFallback = !online && !isOfflineAllowedPath(location.pathname);

  return (
    <div className="flex h-[var(--app-vh)] overflow-x-hidden bg-bg">
      <Sidebar orgSlug={orgSlug} />
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <MobileHeader orgSlug={orgSlug} />
        <div
          className="shrink-0 md:hidden"
          style={{ height: spacing.headerOffset }}
          aria-hidden
        />
        <OfflineBanner />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden px-4 pt-4 md:px-6 md:pt-6">
          <div className="flex min-h-0 flex-1 flex-col">
            {showOfflineFallback ? <OfflineUnavailableMessage /> : <Outlet />}
            {/*
              Respiro inferior (barra de navegação no celular) como elemento, não padding do <main>:
              páginas mais altas que a tela transbordam este wrapper, e o padding do <main>
              não entra na área de rolagem — o fim da página ficava sob a barra.
            */}
            <div
              className="h-[calc(var(--app-bottom-nav-offset)+1rem)] shrink-0 md:h-6"
              aria-hidden
            />
          </div>
        </main>
        {showInstallBanner ? <div className="h-12 shrink-0 md:hidden" aria-hidden /> : null}
        <PwaInstallMobileBanner />
        <BottomNav orgSlug={orgSlug} />
      </div>
    </div>
  );
}
