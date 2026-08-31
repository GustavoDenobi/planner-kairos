import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PreviousEventProgram } from '@/application/agenda';
import type { ProgramItemDetail, ProgramItemStatus } from '@/domain/agenda';
import type { Result } from '@/domain/shared';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { IconCheck, IconPlus } from '@/ui/components/icons';
import { repertoirePiecePath } from '@/ui/features/agenda/agenda-routes';
import {
  agendaErrorMessage,
  programItemStatusLabel,
} from '@/ui/features/agenda/agenda-labels';
import { formatEventTime } from '@/ui/features/agenda/agenda-date';

function formatPreviousEventDate(startsAt: string): string {
  const date = new Date(startsAt);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function statusBadgeClassName(status: ProgramItemStatus): string {
  switch (status) {
    case 'performed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'skipped':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    default:
      return 'bg-bg text-muted';
  }
}

function ProgramItemStatusBadge({ status }: { status: ProgramItemStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClassName(status)}`}
    >
      {status === 'performed' && <IconCheck className="h-3 w-3" aria-hidden="true" />}
      {programItemStatusLabel(status)}
    </span>
  );
}

type EventPreviousProgramSectionProps = {
  orgSlug: string;
  organizationId: string;
  eventId: string;
  recurrenceId: string;
  occurrenceIndex: number;
  canEditProgram: boolean;
  isSaving: boolean;
  getPreviousEventProgram: (
    organizationId: string,
    eventId: string,
  ) => Promise<Result<PreviousEventProgram | null>>;
  onInclude: (program: ProgramItemDetail[]) => Promise<boolean>;
};

export function EventPreviousProgramSection({
  orgSlug,
  organizationId,
  eventId,
  recurrenceId,
  occurrenceIndex,
  canEditProgram,
  isSaving,
  getPreviousEventProgram,
  onInclude,
}: EventPreviousProgramSectionProps) {
  const [previous, setPrevious] = useState<PreviousEventProgram | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isIncluding, setIsIncluding] = useState(false);
  const [includePerformed, setIncludePerformed] = useState(false);

  useEffect(() => {
    if (occurrenceIndex <= 0) {
      setPrevious(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const result = await getPreviousEventProgram(organizationId, eventId);
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setPrevious(null);
        setError(agendaErrorMessage(result.error));
        setIsLoading(false);
        return;
      }
      setPrevious(result.value);
      setIncludePerformed(false);
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [organizationId, eventId, occurrenceIndex, getPreviousEventProgram, recurrenceId]);

  if (occurrenceIndex <= 0) {
    return null;
  }

  const hasPerformedPieces = previous?.program.some((item) => item.status === 'performed') ?? false;
  const visibleItems =
    previous?.program.filter((item) => includePerformed || item.status !== 'performed') ?? [];
  const copyableItems = visibleItems.filter((item) => !item.pieceDeleted);

  async function handleInclude() {
    if (!previous || copyableItems.length === 0) {
      return;
    }
    setIsIncluding(true);
    await onInclude(copyableItems);
    setIsIncluding(false);
  }

  return (
    <section className="mt-8 space-y-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text">Evento anterior</h3>
          {previous && (
            <p className="mt-0.5 text-sm text-muted">
              {formatPreviousEventDate(previous.startsAt)}
              {' · '}
              {formatEventTime(previous.startsAt, previous.endsAt)}
            </p>
          )}
        </div>
        {canEditProgram && copyableItems.length > 0 && (
          <button
            type="button"
            onClick={() => void handleInclude()}
            disabled={isSaving || isIncluding}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg disabled:opacity-50"
          >
            <IconPlus className="h-4 w-4" />
            Incluir no atual
          </button>
        )}
      </div>

      {hasPerformedPieces && previous && previous.program.length > 0 && (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={includePerformed}
            onChange={(event) => setIncludePerformed(event.target.checked)}
            className="rounded border-border"
          />
          Incluir executadas
        </label>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted">Carregando evento anterior…</p>
      ) : !previous ? (
        <p className="text-sm text-muted">Evento anterior não encontrado.</p>
      ) : previous.program.length === 0 ? (
        <p className="text-sm text-muted text-center">Nenhuma obra na programação do evento anterior.</p>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-muted text-center">
          Todas as obras do evento anterior foram executadas.
        </p>
      ) : (
        <ol className="space-y-2">
          {visibleItems.map((item) => {
            const cardContent = (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`font-medium ${item.pieceDeleted ? 'text-muted line-through' : 'text-text'}`}
                    >
                      {item.pieceTitle}
                    </p>
                    <ProgramItemStatusBadge status={item.status} />
                  </div>
                  {item.pieceDeleted && (
                    <p className="mt-0.5 text-xs text-muted">Obra removida do catálogo</p>
                  )}
                  {item.notes && <p className="mt-1 text-sm text-muted">{item.notes}</p>}
                </div>
                {item.pieceCategory && (
                  <CategoryBadge
                    label={item.pieceCategory.name}
                    color={item.pieceCategory.color}
                    slug={item.pieceCategory.slug}
                    className="shrink-0"
                  />
                )}
              </div>
            );

            return (
              <li
                key={item.id}
                className={item.status === 'skipped' ? 'opacity-60' : undefined}
              >
                {item.pieceDeleted ? (
                  <div className="rounded-xl border border-border bg-surface px-4 py-3">
                    {cardContent}
                  </div>
                ) : (
                  <Link
                    to={repertoirePiecePath(orgSlug, item.pieceId)}
                    className="block rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg"
                  >
                    {cardContent}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
