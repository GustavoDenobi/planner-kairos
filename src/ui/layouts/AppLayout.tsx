import { Outlet, useParams } from 'react-router-dom';
import { BottomNav } from '@/ui/layouts/BottomNav';
import { MobileHeader } from '@/ui/layouts/MobileHeader';
import { Sidebar } from '@/ui/layouts/Sidebar';
import { spacing } from '@/ui/theme/tokens';

export function AppLayout() {
  const { orgSlug = 'org' } = useParams();

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar orgSlug={orgSlug} />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileHeader title={orgSlug} />
        <main
          className="flex-1 p-4 md:p-6"
          style={{ paddingBottom: `calc(${spacing.bottomNavHeight} + 1rem)` }}
        >
          <Outlet />
        </main>
        <BottomNav orgSlug={orgSlug} />
      </div>
    </div>
  );
}
