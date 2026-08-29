import { Navigate, Outlet } from 'react-router-dom';
import { useOrg } from '@/ui/app/OrgProvider';

export function PlatformAdminGuard() {
  const { isPlatformAdmin, isLoading } = useOrg();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/orgs" replace />;
  }

  return <Outlet />;
}
