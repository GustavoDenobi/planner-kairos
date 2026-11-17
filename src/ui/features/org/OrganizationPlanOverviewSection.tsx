import type { ReactNode } from 'react';
import type {
  OrganizationPlanOverview,
  StorageUsageCategory,
  StorageUsageEntry,
} from '@/domain/platform/plan';
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
      {/* Sem limite não há o que medir: a barra vazia parecia "0% usado". */}
      {limit !== null ? <QuotaProgressBar current={current} limit={limit} /> : null}
    </div>
  );
}

const STORAGE_CATEGORY_LABELS: Record<StorageUsageCategory, string> = {
  piece_score: 'Partituras',
  piece_audio: 'Áudios de obras',
  practice_audio: 'Entregas de tarefas',
  branding: 'Identidade visual',
  other: 'Outros arquivos',
};

const STORAGE_CATEGORY_COLORS: Record<StorageUsageCategory, string> = {
  piece_score: 'var(--storage-piece-score)',
  piece_audio: 'var(--storage-piece-audio)',
  practice_audio: 'var(--storage-practice-audio)',
  branding: 'var(--storage-branding)',
  other: 'var(--storage-other)',
};

/** Categorias sempre listadas (mesmo zeradas); as demais só quando ocupam espaço. */
const ALWAYS_LISTED: ReadonlySet<StorageUsageCategory> = new Set([
  'piece_score',
  'piece_audio',
  'practice_audio',
]);

function formatShare(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) {
    return '0%';
  }
  const percent = (part / whole) * 100;
  return percent < 1 ? '<1%' : `${Math.round(percent)}%`;
}

function formatFileCount(count: number): string {
  return count === 1 ? '1 arquivo' : `${count} arquivos`;
}

/**
 * Barra do armazenamento dividida por tipo: cada bloco é proporcional ao limite do plano
 * (ou ao total, se ilimitado); o trilho restante é o espaço livre.
 */
function StorageSegmentedBar({
  entries,
  totalBytes,
  limit,
}: {
  entries: StorageUsageEntry[];
  totalBytes: number;
  limit: number | null;
}) {
  const scale = limit !== null && limit > 0 ? Math.max(limit, totalBytes) : totalBytes;
  const visible = entries.filter((entry) => entry.bytes > 0);
  const summary = visible
    .map(
      (entry) =>
        `${STORAGE_CATEGORY_LABELS[entry.category]}: ${formatBytes(entry.bytes)} (${formatShare(entry.bytes, totalBytes)})`,
    )
    .join('; ');

  return (
    <div
      role="img"
      aria-label={`Armazenamento usado por tipo. ${summary || 'Nenhum arquivo.'}`}
      className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface"
    >
      {scale > 0
        ? visible.map((entry) => (
            <div
              key={entry.category}
              title={`${STORAGE_CATEGORY_LABELS[entry.category]}: ${formatBytes(entry.bytes)}`}
              className="h-full min-w-[3px] first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(entry.bytes / scale) * 100}%`,
                backgroundColor: STORAGE_CATEGORY_COLORS[entry.category],
              }}
            />
          ))
        : null}
    </div>
  );
}

function StorageBreakdownList({
  entries,
  totalBytes,
}: {
  entries: StorageUsageEntry[];
  totalBytes: number;
}) {
  const listed = entries.filter((entry) => entry.bytes > 0 || ALWAYS_LISTED.has(entry.category));

  return (
    <ul className="mt-4 space-y-2 text-sm">
      {listed.map((entry) => (
        <li key={entry.category} className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: STORAGE_CATEGORY_COLORS[entry.category] }}
          />
          <span className="min-w-0 flex-1 truncate text-text">
            {STORAGE_CATEGORY_LABELS[entry.category]}
            <span className="ml-1.5 text-xs text-muted">{formatFileCount(entry.fileCount)}</span>
          </span>
          <span className="shrink-0 tabular-nums text-text">{formatBytes(entry.bytes)}</span>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
            {formatShare(entry.bytes, totalBytes)}
          </span>
        </li>
      ))}
    </ul>
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
        <QuotaStatCard label="Obras" current={overview.piecesCount} limit={overview.maxPieces} />
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
          <StorageSegmentedBar
            entries={overview.storageBreakdown}
            totalBytes={overview.storageBytes}
            limit={overview.maxStorageBytes}
          />
          <StorageBreakdownList
            entries={overview.storageBreakdown}
            totalBytes={overview.storageBytes}
          />
        </div>
      </div>
    </div>
  );
}
