import type { ReactNode } from 'react';
import type { OrganizationPlanOverview } from '@/domain/platform/plan';
import {
  formatBytes,
  formatLimit,
  usagePercent,
} from '@/ui/features/platform/platform-labels';

function QuotaValueLine({ current, limitLabel }: { current: ReactNode; limitLabel: string }) {
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-1">
      <span className="text-2xl font-semibold text-text">{current}</span>
      <span className="text-sm font-normal text-muted">/ {limitLabel}</span>
    </p>
  );
}

function QuotaProgressBar({ current, limit }: { current: number; limit: number | null }) {
  const percent = usagePercent(current, limit) ?? 0;

  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

function QuotaStatCard({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <p className="text-sm text-muted">{label}</p>
      <QuotaValueLine current={current} limitLabel={formatLimit(limit)} />
      <QuotaProgressBar current={current} limit={limit} />
    </div>
  );
}

type OrganizationPlanOverviewSectionProps = {
  overview: OrganizationPlanOverview | null;
  isLoading: boolean;
};

export function OrganizationPlanOverviewSection({
  overview,
  isLoading,
}: OrganizationPlanOverviewSectionProps) {
  if (isLoading) {
    return <p className="text-sm text-muted">Carregando plano e cotas…</p>;
  }

  if (!overview) {
    return (
      <p className="text-sm text-muted">
        Não foi possível carregar as informações do plano. Tente novamente em instantes.
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-text">Plano ativo</h2>
      <p className="mt-1 text-sm text-text">{overview.planName}</p>
      {overview.planDescription && (
        <p className="mt-1 text-xs text-muted">{overview.planDescription}</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <QuotaStatCard
          label="Grupos"
          current={overview.groupsCount}
          limit={overview.maxGroups}
        />
        <QuotaStatCard
          label="Músicos"
          current={overview.musiciansCount}
          limit={overview.maxMusicians}
        />
        <QuotaStatCard label="Peças" current={overview.piecesCount} limit={overview.maxPieces} />
        <QuotaStatCard label="Eventos" current={overview.eventsCount} limit={null} />
        <div className="rounded-xl border border-border bg-bg p-4 sm:col-span-2">
          <p className="text-sm text-muted">Armazenamento</p>
          <QuotaValueLine
            current={formatBytes(overview.storageBytes)}
            limitLabel={
              overview.maxStorageBytes === null
                ? 'Ilimitado'
                : formatBytes(overview.maxStorageBytes)
            }
          />
          <QuotaProgressBar
            current={overview.storageBytes}
            limit={overview.maxStorageBytes}
          />
        </div>
      </div>
    </div>
  );
}
