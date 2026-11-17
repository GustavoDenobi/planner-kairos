import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MusicianEventHistoryItem, MusicianHistoryPeriod } from '@/domain/agenda';
import {
  eventDisplayTitle,
  isEventCancelled,
  musicianEventStartsInPeriod,
} from '@/domain/agenda';
import { useAgenda } from '@/ui/app/AppServicesContext';
import {
  agendaErrorMessage,
  EVENT_CANCELLED_LABEL,
} from '@/ui/features/agenda/agenda-labels';
import { eventPath } from '@/ui/features/agenda/agenda-routes';
import { formatEventScheduleLabel } from '@/ui/features/agenda/agenda-date';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';
import { EventHistoryFilters } from '@/ui/features/ensemble/EventHistoryFilters';
import {
  absenceRateLabel as formatAbsenceRate,
  activeHistoryTypeIds,
  historyPeriodStatLabels,
  historyTypeOptions,
  type HistoryTypeOption,
} from '@/ui/features/ensemble/event-history-filters';
import { scrollContentEndPaddingClass } from '@/ui/layouts/OrgListPageLayout';

const PAGE_SIZE = 20;

type MusicianHistorySectionProps = {
  organizationId: string;
  orgSlug: string;
  musicianId: string;
  isOfflineReadOnly: boolean;
  /** Filtros aplicados ao abrir (ex.: vindos do histórico do grupo). */
  initialPeriod?: MusicianHistoryPeriod;
  initialTypeIds?: string[];
  /** Tipos sempre exibidos no filtro, mesmo sem eventos do músico (mantém a seleção vinda do grupo). */
  pinnedTypeOptions?: HistoryTypeOption[];
};

export function MusicianHistorySection({
  organizationId,
  orgSlug,
  musicianId,
  isOfflineReadOnly,
  initialPeriod = 'year',
  initialTypeIds,
  pinnedTypeOptions,
}: MusicianHistorySectionProps) {
  const agenda = useAgenda();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [allEvents, setAllEvents] = useState<MusicianEventHistoryItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const initialFiltersRef = useRef({ period: initialPeriod, typeIds: initialTypeIds ?? [] });
  const [period, setPeriod] = useState<MusicianHistoryPeriod>(initialPeriod);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>(initialFiltersRef.current.typeIds);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPeriod(initialFiltersRef.current.period);
  }, [musicianId]);

  useEffect(() => {
    if (isOfflineReadOnly) {
      setAllEvents([]);
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
        setError(agendaErrorMessage(result.error));
        return;
      }
      setAllEvents(result.value.events);
      setVisibleCount(PAGE_SIZE);
      setSelectedTypeIds(initialFiltersRef.current.typeIds);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [agenda, isOfflineReadOnly, organizationId, musicianId]);

  const periodEvents = useMemo(
    () => allEvents.filter((event) => musicianEventStartsInPeriod(event.startsAt, period)),
    [allEvents, period],
  );

  const typeOptions = useMemo(() => {
    const options = historyTypeOptions(periodEvents);
    const missingPinned = (pinnedTypeOptions ?? []).filter(
      (pinned) => !options.some((option) => option.id === pinned.id),
    );
    if (missingPinned.length === 0) {
      return options;
    }
    return [...options, ...missingPinned].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [periodEvents, pinnedTypeOptions]);

  const filteredEvents = useMemo(() => {
    const selected = activeHistoryTypeIds(selectedTypeIds, typeOptions);
    if (selected.length === 0) {
      return periodEvents;
    }
    const selectedSet = new Set(selected);
    return periodEvents.filter((event) => selectedSet.has(event.typeId));
  }, [periodEvents, selectedTypeIds, typeOptions]);

  const eventCount = filteredEvents.length;
  const absenceCount = filteredEvents.filter((event) => event.wasAbsent).length;
  const statLabels = historyPeriodStatLabels(period);

  const toggleType = useCallback((typeId: string) => {
    setSelectedTypeIds((current) =>
      current.includes(typeId)
        ? current.filter((id) => id !== typeId)
        : [...current, typeId],
    );
    setVisibleCount(PAGE_SIZE);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) {
      return;
    }
    setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredEvents.length));
  }, [filteredEvents.length, hasMore, isLoading]);

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

  const absenceRateLabel = isLoading ? null : formatAbsenceRate(absenceCount, eventCount);

  function handlePeriodChange(next: MusicianHistoryPeriod) {
    setPeriod(next);
    setVisibleCount(PAGE_SIZE);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  if (isOfflineReadOnly) {
    return (
      <p className="text-sm text-muted">
        O histórico de eventos não está disponível no modo offline.
      </p>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm font-medium text-text">{statLabels.events}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text">
            {isLoading ? '…' : eventCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm font-medium text-text">{statLabels.absences}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <p
              className={`text-2xl font-semibold tabular-nums ${isLoading ? 'text-text' : 'text-red-600 dark:text-red-400'}`}
            >
              {isLoading ? '…' : absenceCount}
            </p>
            {absenceRateLabel && (
              <span className="text-sm font-medium tabular-nums text-red-800/80 dark:text-red-400/80">
                {absenceRateLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="my-4 shrink-0">
        <EventHistoryFilters
          period={period}
          onPeriodChange={handlePeriodChange}
          typeOptions={typeOptions}
          selectedTypeIds={selectedTypeIds}
          onToggleType={toggleType}
          onClearTypes={() => {
            setSelectedTypeIds([]);
            setVisibleCount(PAGE_SIZE);
          }}
        />
      </div>

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border pt-3 ${scrollContentEndPaddingClass}`}
      >
        {isLoading && <p className="text-sm text-muted">Carregando histórico…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!isLoading && !error && allEvents.length === 0 && (
          <p className="text-sm text-muted">
            Este músico ainda não participou de nenhum evento.
          </p>
        )}

        {!isLoading && !error && allEvents.length > 0 && periodEvents.length === 0 && (
          <p className="text-sm text-muted">Nenhum evento neste período.</p>
        )}

        {!isLoading && !error && periodEvents.length > 0 && filteredEvents.length === 0 && (
          <p className="text-sm text-muted">Nenhum evento dos tipos selecionados.</p>
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
