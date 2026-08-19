import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';

export function AuthGuard() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <OrgGuard>
      <Outlet />
    </OrgGuard>
  );
}

function OrgGuard({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams();
  const { organizations, isLoading, resolveOrgBySlug } = useOrg();

  if (!orgSlug) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  const isMember = resolveOrgBySlug(orgSlug) !== null;
  if (!isMember && organizations.length > 0) {
    return <Navigate to="/orgs" replace />;
  }

  if (!isMember) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted">
          Organização não encontrada. Conecte-se à internet para sincronizar seus dados.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
