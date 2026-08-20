import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import { resolveHomeRedirectPath } from '@/application/offline/identity-snapshot-use-cases';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { ORG_STORAGE_KEY } from '@/ui/app/OrgProvider';
import { useOffline } from '@/ui/app/AppServicesContext';

export function HomeRedirect() {
  const { session, isLoading } = useAuth();
  const offline = useOffline();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const storedOrgSlug = localStorage.getItem(ORG_STORAGE_KEY);
    const isOnline = isBrowserOnline();

    if (session || isOnline) {
      setTarget(
        resolveHomeRedirectPath({
          hasSession: Boolean(session),
          isOnline,
          storedOrgSlug,
          snapshot: null,
        }),
      );
      return;
    }

    void offline.getIdentitySnapshot().then((snapshot) => {
      setTarget(
        resolveHomeRedirectPath({
          hasSession: false,
          isOnline: false,
          storedOrgSlug,
          snapshot,
        }),
      );
    });
  }, [isLoading, session, offline]);

  if (!target) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  return <Navigate to={target} replace />;
}
