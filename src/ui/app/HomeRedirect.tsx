import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
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

    if (session) {
      const slug = localStorage.getItem(ORG_STORAGE_KEY);
      setTarget(slug ? `/${slug}/leitura` : '/orgs');
      return;
    }

    void offline.getIdentitySnapshot().then((snapshot) => {
      if (snapshot) {
        const slug = snapshot.currentOrgSlug ?? localStorage.getItem(ORG_STORAGE_KEY);
        setTarget(slug ? `/${slug}/leitura` : '/orgs');
      } else {
        setTarget('/login');
      }
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
