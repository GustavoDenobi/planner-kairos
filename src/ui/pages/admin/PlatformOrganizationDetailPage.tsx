import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PlatformOrganizationDetail } from '@/domain/platform/plan';
import type { Plan } from '@/domain/platform/plan';
import type { BillingEntry, OrganizationBilling } from '@/domain/platform/billing';
import { usePlatform } from '@/ui/app/AppServicesContext';
import { BackButton } from '@/ui/components/BackButton';
import {
  adminEmptyStateClass,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSectionClass,
  adminSelectClass,
} from '@/ui/features/platform/admin-page-shell';
import {
  formatBytes,
  formatLimit,
  platformErrorMessage,
  usagePercent,
} from '@/ui/features/platform/platform-labels';
import { OrganizationBillingSection } from '@/ui/features/platform/OrganizationBillingSection';
import { orgPageContentClass } from '@/ui/layouts/OrgListPageLayout';

function StatCard({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number | null;
}) {
  const percent = usagePercent(current, limit);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{current}</p>
      <p className="mt-1 text-xs text-muted">Limite: {formatLimit(limit)}</p>
      {percent !== null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

export function PlatformOrganizationDetailPage() {
  const { orgId = '' } = useParams();
  const platform = usePlatform();
  const [organization, setOrganization] = useState<PlatformOrganizationDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planNote, setPlanNote] = useState('');
  const [stopBilling, setStopBilling] = useState(false);
  const [billing, setBilling] = useState<OrganizationBilling | null>(null);
  const [billingEntries, setBillingEntries] = useState<BillingEntry[]>([]);

  useEffect(() => {
    void loadData();
  }, [orgId]);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    const [orgResult, plansResult, billingResult, entriesResult] = await Promise.all([
      platform.getOrganization(orgId),
      platform.listPlans(),
      platform.getOrganizationBilling(orgId),
      platform.listOrganizationBillingEntries(orgId),
    ]);

    if (!orgResult.ok) {
      setError(platformErrorMessage(orgResult.error));
      setIsLoading(false);
      return;
    }

    if (!plansResult.ok) {
      setError(platformErrorMessage(plansResult.error));
      setIsLoading(false);
      return;
    }

    if (!orgResult.value) {
      setError('Organização não encontrada.');
      setIsLoading(false);
      return;
    }

    setOrganization(orgResult.value);
    setSelectedPlanId(orgResult.value.planId);
    setPlans(plansResult.value);
    setPlanNote('');
    setStopBilling(false);
    if (billingResult.ok && entriesResult.ok) {
      setBilling(billingResult.value);
      setBillingEntries(entriesResult.value);
    } else {
      setError(
        platformErrorMessage(
          !billingResult.ok ? billingResult.error : !entriesResult.ok ? entriesResult.error : '',
        ),
      );
    }
    setIsLoading(false);
  }

  async function handleSavePlan() {
    if (!organization || selectedPlanId === organization.planId) {
      return;
    }

    setIsSavingPlan(true);
    const result = await platform.assignOrganizationPlan(organization.id, selectedPlanId, {
      note: planNote.trim() || null,
      stopBilling,
    });
    setIsSavingPlan(false);

    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      return;
    }

    await loadData();
  }

  if (isLoading) {
    return (
      <div className={orgPageContentClass}>
        <p className={adminEmptyStateClass}>Carregando organização…</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className={orgPageContentClass}>
        <p className="text-sm text-red-600">{error ?? 'Organização não encontrada.'}</p>
      </div>
    );
  }

  return (
    <div className={orgPageContentClass}>
      <BackButton fallbackTo="/admin/organizacoes" />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">{organization.name}</h1>
          <p className="mt-1 text-sm text-muted">{organization.slug}</p>
        </div>
        <Link to={`/${organization.slug}/agenda`} className={adminPrimaryButtonClass}>
          Entrar na organização
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Grupos" current={organization.groupsCount} limit={organization.maxGroups} />
        <StatCard
          label="Músicos"
          current={organization.musiciansCount}
          limit={organization.maxMusicians}
        />
        <StatCard label="Obras" current={organization.piecesCount} limit={organization.maxPieces} />
        <StatCard label="Eventos" current={organization.eventsCount} limit={null} />
        <StatCard label="Membros" current={organization.membershipsCount} limit={null} />
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Storage</p>
          <p className="mt-1 text-2xl font-semibold text-text">
            {formatBytes(organization.storageBytes)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Limite:{' '}
            {organization.maxStorageBytes === null
              ? 'Ilimitado'
              : formatBytes(organization.maxStorageBytes)}
          </p>
          {usagePercent(organization.storageBytes, organization.maxStorageBytes) !== null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${usagePercent(organization.storageBytes, organization.maxStorageBytes)}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <OrganizationBillingSection
        organizationId={organization.id}
        billing={billing}
        entries={billingEntries}
        onChanged={loadData}
      />

      <section className={`mt-8 ${adminSectionClass}`}>
        <h2 className="font-semibold text-text">Plano ativo</h2>
        <p className="mt-1 text-sm text-muted">
          Plano atual: {organization.planName} ({organization.planSlug})
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">Alterar plano</span>
            <select
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
              className={adminSelectClass}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                  {!plan.isActive ? ' (inativo)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleSavePlan()}
            disabled={isSavingPlan || selectedPlanId === organization.planId}
            className={adminPrimaryButtonClass}
          >
            Salvar plano
          </button>
        </div>

        {selectedPlanId !== organization.planId && (
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Motivo (vai para o histórico de cobrança)</span>
              <input
                value={planNote}
                onChange={(event) => setPlanNote(event.target.value)}
                placeholder="Ex.: rebaixado por atraso; upgrade pago via Pix"
                className={adminFieldClass}
              />
            </label>
            {billing?.isActive && (
              <label className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={stopBilling}
                  onChange={(event) => setStopBilling(event.target.checked)}
                />
                Encerrar a cobrança (a organização deixa de ver avisos de pagamento)
              </label>
            )}
            <p className="text-xs text-muted">
              Rebaixar não apaga nada: se a organização passar dos limites do novo plano, só não
              conseguirá cadastrar itens novos.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
