import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useLoadingBarPlacement } from '@/ui/app/loading-bar/useLoadingBar';
import { OfflineUnavailableMessage } from '@/ui/features/pwa/OfflineUnavailableMessage';
import { OfflineBanner } from '@/ui/features/pwa/OfflineBanner';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { BottomNav } from '@/ui/layouts/BottomNav';
import { MobileHeader } from '@/ui/layouts/MobileHeader';
import { Sidebar } from '@/ui/layouts/Sidebar';
import { spacing } from '@/ui/theme/tokens';

function isOfflineAllowedPath(pathname: string): boolean {
  return pathname.includes('/leitura');
}

export function AppLayout() {
  const { orgSlug = 'org' } = useParams();
  useLoadingBarPlacement('belowAppHeader');
  const online = useOnlineStatus();
  const location = useLocation();
  const showOfflineFallback = !online && !isOfflineAllowedPath(location.pathname);

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar orgSlug={orgSlug} />
      <div className="flex min-h-dvh flex-1 flex-col">
        <MobileHeader orgSlug={orgSlug} />
        <div
          className="shrink-0 md:hidden"
          style={{ height: spacing.headerOffset }}
          aria-hidden
        />
        <OfflineBanner />
        <main
          className="flex-1 px-4 py-4 md:p-6"
          style={{ paddingBottom: `calc(${spacing.bottomNavOffset} + 1rem)` }}
        >
          {showOfflineFallback ? <OfflineUnavailableMessage /> : <Outlet />}
        </main>
        <BottomNav orgSlug={orgSlug} />
      </div>
    </div>
  );
}
