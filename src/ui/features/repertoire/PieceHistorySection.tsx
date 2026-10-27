import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PieceEventHistoryItem } from '@/domain/agenda';
import { eventDisplayTitle, isEventCancelled } from '@/domain/agenda';
import { useAgenda } from '@/ui/app/AppServicesContext';
import {
  agendaErrorMessage,
  EVENT_CANCELLED_LABEL,
  programItemStatusLabel,
} from '@/ui/features/agenda/agenda-labels';
import { eventPath } from '@/ui/features/agenda/agenda-routes';
import { formatEventDateNumeric, formatEventScheduleLabel } from '@/ui/features/agenda/agenda-date';
import { localCalendarDaysSince } from '@/domain/agenda';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';

const PAGE_SIZE = 20;

type PieceHistorySectionProps = {
  organizationId: string;
  orgSlug: string;
  pieceId: string;
};

function formatDaysSincePerformance(days: number): string {
  if (days === 0) {
    return 'Hoje';
  }
  if (days === 1) {
    return 'Há 1 dia';
  }
  return `Há ${days} dias`;
}

function programStatusBadgeClass(status: PieceEventHistoryItem['programStatus']): string {
  switch (status) {
    case 'performed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300';
    case 'skipped':
      return 'bg-bg text-muted';
    default:
      return 'bg-primary/10 text-primary';
  }
}

export function PieceHistorySection({
  organizationId,
  orgSlug,
  pieceId,
}: PieceHistorySectionProps) {
  const agenda = useAgenda();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [allEvents, setAllEvents] = useState<PieceEventHistoryItem[]>([]);
  const [performancesThisYear, setPerformancesThisYear] = useState(0);
  const [lastPerformanceAt, setLastPerformanceAt] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const result = await agenda.getPieceEventHistory(organizationId, pieceId);
      if (cancelled) {
        return;
      }
      setIsLoading(false);
      if (!result.ok) {
        setAllEvents([]);
        setPerformancesThisYear(0);
        setLastPerformanceAt(null);
        setError(agendaErrorMessage(result.error));
        return;
      }
      setAllEvents(result.value.events);
      setPerformancesThisYear(result.value.performancesThisYear);
      setLastPerformanceAt(result.value.lastPerformanceAt);
      setVisibleCount(PAGE_SIZE);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [agenda, organizationId, pieceId]);

  const visibleEvents = allEvents.slice(0, visibleCount);
  const hasMore = visibleCount < allEvents.length;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) {
      return;
    }
    setVisibleCount((current) => Math.min(current + PAGE_SIZE, allEvents.length));
  }, [allEvents.length, hasMore, isLoading]);

  useEffect(() => {
    if (!hasMore || isLoading) {
      return;
    }

    const sentinel = sentinelRef.current;
    const scrollRoot = scrollRef.current;
    if (!sentinel || !scrollRoot) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { root: scrollRoot, rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore, visibleEvents.length]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm font-medium text-text">Execuções neste ano</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text">
            {isLoading ? '…' : performancesThisYear}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm font-medium text-text">Última execução</p>
          {isLoading ? (
            <p className="mt-1 text-2xl font-semibold text-text">…</p>
          ) : lastPerformanceAt ? (
            <>
              <p className="mt-1 text-lg font-semibold leading-snug text-text">
                {formatEventDateNumeric(lastPerformanceAt)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {formatDaysSincePerformance(localCalendarDaysSince(lastPerformanceAt))}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Nenhuma execução registrada</p>
          )}
        </div>
      </div>

      <hr className="my-4 shrink-0 border-border" />

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {isLoading && <p className="text-sm text-muted">Carregando histórico…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!isLoading && !error && allEvents.length === 0 && (
          <p className="text-sm text-muted">Esta peça ainda não apareceu em nenhum evento.</p>
        )}

        <ul className="space-y-2">
          {visibleEvents.map((event) => {
            const cancelled = isEventCancelled(event);
            const title = eventDisplayTitle(event, { name: event.typeName });
            const badgeStyle = eventTypeBadgeStyle({
              kind: event.typeKind,
              color: event.typeColor,
              name: event.typeName,
            });

            return (
              <li key={event.eventId}>
                <Link
                  to={eventPath(orgSlug, event.eventId)}
                  className={`block rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg ${cancelled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`font-medium text-text ${cancelled ? 'line-through' : ''}`}
                      >
                        {title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatEventScheduleLabel(event.startsAt, event.endsAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={badgeStyle}
                      >
                        {event.typeName}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${programStatusBadgeClass(event.programStatus)}`}
                      >
                        {programItemStatusLabel(event.programStatus)}
                      </span>
                      {cancelled && (
                        <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-muted">
                          {EVENT_CANCELLED_LABEL}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {hasMore && <div ref={sentinelRef} className="h-4 shrink-0" aria-hidden />}
      </div>
    </section>
  );
}
