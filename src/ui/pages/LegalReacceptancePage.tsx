import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import { resolveHomeRedirectPath } from '@/application/offline/identity-snapshot-use-cases';
import type { PendingLegalAcceptance } from '@/domain/identity/legal-documents';
import { organizationRulesRequireAcceptance } from '@/domain/identity/legal-documents';
import { useIdentity, useOffline } from '@/ui/app/AppServicesContext';
import { ORG_STORAGE_KEY } from '@/ui/app/OrgProvider';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { LegalAcceptanceCheckboxes } from '@/ui/components/LegalAcceptanceCheckboxes';
import { OrganizationRulesAcceptance } from '@/ui/components/OrganizationRulesAcceptance';

export function LegalReacceptancePage() {
  const identity = useIdentity();
  const offline = useOffline();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgSlug = searchParams.get('org');

  const [pending, setPending] = useState<PendingLegalAcceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformAccepted, setPlatformAccepted] = useState(false);
  const [organizationAccepted, setOrganizationAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void identity.getPendingLegalAcceptances(userId, orgSlug).then((items) => {
      setPending(items);
      setLoading(false);
    });
  }, [identity, userId, orgSlug]);

  const needsPlatform = pending.some(
    (item) => item.documentType === 'terms_of_use' || item.documentType === 'privacy_policy',
  );
  const organizationItem = pending.find((item) => item.documentType === 'organization_rules');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) {
      return;
    }

    if (needsPlatform && !platformAccepted) {
      setError('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }

    if (organizationItem && !organizationAccepted) {
      setError('Aceite o regulamento da organização para continuar.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await identity.recordPendingLegalAcceptances(userId, pending);
      const snapshot = await offline.getIdentitySnapshot();
      const path = resolveHomeRedirectPath({
        hasSession: true,
        isOnline: isBrowserOnline(),
        storedOrgSlug: orgSlug ?? localStorage.getItem(ORG_STORAGE_KEY),
        snapshot,
      });
      navigate(path, { replace: true });
    } catch {
      setError('Não foi possível registrar o aceite. Tente novamente.');
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  if (pending.length === 0) {
    return <Navigate to="/orgs" replace />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-bg p-4 pt-8">
      <article className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <header>
          <h1 className="font-brand text-2xl font-bold text-text">Atualização necessária</h1>
          <p className="mt-2 text-sm text-muted">
            Para continuar usando o Planner Musical, leia e aceite os documentos abaixo.
          </p>
        </header>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          {pending.some((item) => item.documentType === 'terms_of_use') && (
            <section className="rounded-lg border border-border bg-bg p-3 text-sm text-muted">
              <h2 className="font-semibold text-text">Termos de Uso</h2>
              <p className="mt-2">
                Consulte a versão completa em{' '}
                <Link to="/termos" target="_blank" className="text-primary hover:underline">
                  Termos de Uso
                </Link>
                .
              </p>
            </section>
          )}

          {pending.some((item) => item.documentType === 'privacy_policy') && (
            <section className="rounded-lg border border-border bg-bg p-3 text-sm text-muted">
              <h2 className="font-semibold text-text">Política de Privacidade</h2>
              <p className="mt-2">
                Consulte a versão completa em{' '}
                <Link to="/privacidade" target="_blank" className="text-primary hover:underline">
                  Política de Privacidade
                </Link>
                .
              </p>
            </section>
          )}

          {needsPlatform && (
            <LegalAcceptanceCheckboxes
              accepted={platformAccepted}
              onChange={setPlatformAccepted}
              disabled={isSubmitting}
            />
          )}

          {organizationItem &&
            organizationRulesRequireAcceptance({
              title: organizationItem.title,
              markdown: organizationItem.markdown ?? '',
              version: Number(organizationItem.documentVersion),
              requiresAcceptance: true,
            }) && (
              <OrganizationRulesAcceptance
                organizationName={organizationItem.organizationName ?? 'Organização'}
                title={organizationItem.title}
                markdown={organizationItem.markdown ?? ''}
                accepted={organizationAccepted}
                onChange={setOrganizationAccepted}
                disabled={isSubmitting}
              />
            )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando…' : 'Continuar'}
          </button>
        </form>
      </article>
    </div>
  );
}
