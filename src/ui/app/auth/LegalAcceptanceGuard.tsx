import { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';

export function LegalAcceptanceGuard({ children }: { children: React.ReactNode }) {
  const identity = useIdentity();
  const { userId } = useAuth();
  const location = useLocation();
  const { orgSlug } = useParams();
  const [checking, setChecking] = useState(true);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!userId) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    void identity.getPendingLegalAcceptances(userId, orgSlug ?? null).then((pending) => {
      if (cancelled) {
        return;
      }

      setHasPending(pending.length > 0);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [identity, userId, orgSlug, location.pathname]);

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  if (hasPending) {
    const orgQuery = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : '';
    return <Navigate to={`/reaceitar-termos${orgQuery}`} replace />;
  }

  return <>{children}</>;
}
