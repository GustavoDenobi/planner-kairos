import { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { shouldPromptOfflineOrgSync } from '@/application/offline/identity-snapshot-use-cases';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

export function AuthGuard() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
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
  const { organizations, isLoading, isOfflineData, resolveOrgBySlug, refreshOrganizations } =
    useOrg();
  const online = useOnlineStatus();
  const [retriedSlug, setRetriedSlug] = useState<string | null>(null);

  const isMember = orgSlug ? resolveOrgBySlug(orgSlug) !== null : true;

  useEffect(() => {
    if (!orgSlug || isLoading || isMember || retriedSlug === orgSlug) {
      return;
    }

    setRetriedSlug(orgSlug);
    void refreshOrganizations();
  }, [orgSlug, isLoading, isMember, retriedSlug, refreshOrganizations]);

  if (!orgSlug) {
    return <>{children}</>;
  }

  if (isMember) {
    return <>{children}</>;
  }

  if (isLoading || retriedSlug !== orgSlug) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  if (organizations.length > 0 || !shouldPromptOfflineOrgSync(online, isOfflineData)) {
    return <Navigate to="/orgs" replace />;
  }

  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <p className="text-sm text-muted">
        Organização não encontrada. Conecte-se à internet para sincronizar seus dados.
      </p>
    </div>
  );
}
