import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Plan } from '@/domain/platform/plan';
import { usePlatform } from '@/ui/app/AppServicesContext';
import {
  AdminPageShell,
  adminEmptyStateClass,
  adminPrimaryButtonClass,
} from '@/ui/features/platform/admin-page-shell';
import { formatBytes, formatLimit, platformErrorMessage } from '@/ui/features/platform/platform-labels';

export function PlatformPlansPage() {
  const platform = usePlatform();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPlans();
  }, []);

  async function loadPlans() {
    setIsLoading(true);
    const result = await platform.listPlans();

    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    setPlans(result.value);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <AdminPageShell title="Planos">
        <p className={adminEmptyStateClass}>Carregando planos…</p>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="Planos"
      subtitle={`${plans.length} cadastrados`}
      action={
        <Link to="/admin/planos/novo" className={adminPrimaryButtonClass}>
          Novo plano
        </Link>
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {plans.length === 0 ? (
        <p className={adminEmptyStateClass}>Nenhum plano cadastrado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                to={`/admin/planos/${plan.id}`}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-bg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-text">{plan.name}</h2>
                    <p className="text-sm text-muted">{plan.slug}</p>
                  </div>
                  <span
                    className={[
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      plan.isActive ? 'bg-emerald-500/10 text-emerald-700' : 'bg-bg text-muted',
                    ].join(' ')}
                  >
                    {plan.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {plan.description && (
                  <p className="mt-3 text-sm text-muted">{plan.description}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>Grupos: {formatLimit(plan.maxGroups)}</span>
                  <span>Músicos: {formatLimit(plan.maxMusicians)}</span>
                  <span>Peças: {formatLimit(plan.maxPieces)}</span>
                  <span>
                    Storage:{' '}
                    {plan.maxStorageBytes === null
                      ? 'Ilimitado'
                      : formatBytes(plan.maxStorageBytes)}
                  </span>
                  <span>
                    {plan.organizationsCount}{' '}
                    {plan.organizationsCount === 1 ? 'organização' : 'organizações'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminPageShell>
  );
}
