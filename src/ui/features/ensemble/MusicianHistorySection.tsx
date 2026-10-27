import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MusicianEventHistoryItem } from '@/domain/agenda';
import { eventDisplayTitle, isEventCancelled } from '@/domain/agenda';
import { useAgenda } from '@/ui/app/AppServicesContext';
import {
  agendaErrorMessage,
  EVENT_CANCELLED_LABEL,
} from '@/ui/features/agenda/agenda-labels';
import { eventPath } from '@/ui/features/agenda/agenda-routes';
import { formatEventScheduleLabel } from '@/ui/features/agenda/agenda-date';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';

const PAGE_SIZE = 20;

type MusicianHistorySectionProps = {
  organizationId: string;
  orgSlug: string;
  musicianId: string;
  isOfflineReadOnly: boolean;
};

export function MusicianHistorySection({
  organizationId,
  orgSlug,
  musicianId,
  isOfflineReadOnly,
}: MusicianHistorySectionProps) {
  const agenda = useAgenda();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [allEvents, setAllEvents] = useState<MusicianEventHistoryItem[]>([]);
  const [eventsThisYear, setEventsThisYear] = useState(0);
  const [absencesThisYear, setAbsencesThisYear] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOfflineReadOnly) {
      setAllEvents([]);
      setEventsThisYear(0);
      setAbsencesThisYear(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const result = await agenda.getMusicianEventHistory(organizationId, musicianId);
      if (cancelled) {
        return;
      }
      setIsLoading(false);
      if (!result.ok) {
        setAllEvents([]);
        setEventsThisYear(0);
        setAbsencesThisYear(0);
        setError(agendaErrorMessage(result.error));
        return;
      }
      setAllEvents(result.value.events);
      setEventsThisYear(result.value.eventsThisYear);
      setAbsencesThisYear(result.value.absencesThisYear);
      setVisibleCount(PAGE_SIZE);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [agenda, isOfflineReadOnly, organizationId, musicianId]);

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
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore, visibleEvents.length]);

  const absenceRateLabel =
    !isLoading && eventsThisYear > 0
      ? `${((absencesThisYear / eventsThisYear) * 100).toLocaleString('pt-BR', {
          maximumFractionDigits: 1,
        })}%`
      : null;

  if (isOfflineReadOnly) {
    return (
      <p className="text-sm text-muted">
        O histórico de eventos não está disponível no modo offline.
      </p>
    );
  }

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm font-medium text-text">Eventos neste ano</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text">
            {isLoading ? '…' : eventsThisYear}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm font-medium text-text">Faltas neste ano</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <p
              className={`text-2xl font-semibold tabular-nums ${isLoading ? 'text-text' : 'text-red-600 dark:text-red-400'}`}
            >
              {isLoading ? '…' : absencesThisYear}
            </p>
            {absenceRateLabel && (
              <span className="text-sm font-medium tabular-nums text-red-800/80 dark:text-red-400/80">
                {absenceRateLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <hr className="my-6 border-border" />

      <div>
        {isLoading && <p className="text-sm text-muted">Carregando histórico…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!isLoading && !error && allEvents.length === 0 && (
          <p className="text-sm text-muted">
            Este músico ainda não participou de nenhum evento.
          </p>
        )}

        <ul className="space-y-2">
          {visibleEvents.map((event) => {
            const cancelled = isEventCancelled(event);
            const absent = event.wasAbsent;
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
                  className={`block rounded-xl border px-4 py-3 transition-colors ${
                    absent
                      ? 'border-red-300 bg-red-50 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:hover:bg-red-950/50'
                      : 'border-border bg-surface hover:bg-bg'
                  } ${cancelled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`font-medium ${cancelled ? 'line-through' : ''} ${
                          absent ? 'text-red-700 dark:text-red-300' : 'text-text'
                        }`}
                      >
                        {title}
                      </p>
                      <p
                        className={`mt-0.5 text-sm ${
                          absent ? 'text-red-600/80 dark:text-red-400/80' : 'text-muted'
                        }`}
                      >
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
                      {absent && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
                          Ausente
                        </span>
                      )}
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
