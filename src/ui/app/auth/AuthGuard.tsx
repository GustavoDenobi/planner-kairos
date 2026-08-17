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
  const { organizations, isLoading, currentOrg } = useOrg();

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

  const isMember = organizations.some((o) => o.slug === orgSlug);
  if (!isMember) {
    return <Navigate to="/orgs" replace />;
  }

  if (currentOrg?.slug !== orgSlug) {
    // slug valid but not selected — still allow navigation
    return <>{children}</>;
  }

  return <>{children}</>;
}
