import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MusicianEventHistory, MusicianHistoryPeriod } from '@/domain/agenda';
import { musicianEventStartsInPeriod } from '@/domain/agenda';
import type { GroupAssignmentListItem } from '@/domain/ensemble';
import { useAgenda } from '@/ui/app/AppServicesContext';
import { Modal } from '@/ui/components/Modal';
import { agendaErrorMessage } from '@/ui/features/agenda/agenda-labels';
import { ensembleRoleLabel } from '@/ui/features/ensemble/ensemble-labels';
import { EventHistoryFilters } from '@/ui/features/ensemble/EventHistoryFilters';
import {
  absenceRateLabel,
  activeHistoryTypeIds,
  DEFAULT_GROUP_HISTORY_MEMBER_SORT,
  GROUP_HISTORY_MEMBER_SORT_OPTIONS,
  historyPeriodStatLabels,
  historyTypeOptions,
  sortGroupHistoryMembers,
  type GroupHistoryMemberSort,
} from '@/ui/features/ensemble/event-history-filters';
import { MusicianHistorySection } from '@/ui/features/ensemble/MusicianHistorySection';
import { matchesSearchText } from '@/ui/utils/normalize-search-text';

type GroupMember = {
  musicianId: string;
  musicianName: string;
  detailsLabel: string;
};

function assignmentDetailsLabel(assignment: GroupAssignmentListItem): string {
  return [ensembleRoleLabel(assignment.ensembleRole), assignment.sectionName, assignment.partName]
    .filter(Boolean)
    .join(' · ');
}

/** Um músico pode ter várias atribuições no mesmo grupo: agrupa em uma linha só. */
function groupMembers(assignments: GroupAssignmentListItem[]): GroupMember[] {
  const byMusician = new Map<string, { name: string; labels: string[] }>();
  for (const assignment of assignments) {
    const entry = byMusician.get(assignment.musicianId) ?? {
      name: assignment.musicianName,
      labels: [],
    };
    const label = assignmentDetailsLabel(assignment);
    if (label && !entry.labels.includes(label)) {
      entry.labels.push(label);
    }
    byMusician.set(assignment.musicianId, entry);
  }
  return [...byMusician.entries()]
    .map(([musicianId, entry]) => ({
      musicianId,
      musicianName: entry.name,
      detailsLabel: entry.labels.join(' / '),
    }))
    .sort((a, b) => a.musicianName.localeCompare(b.musicianName, 'pt-BR'));
}

type GroupHistorySectionProps = {
  organizationId: string;
  orgSlug: string;
  assignments: GroupAssignmentListItem[];
  isOfflineReadOnly: boolean;
};

export function GroupHistorySection({
  organizationId,
  orgSlug,
  assignments,
  isOfflineReadOnly,
}: GroupHistorySectionProps) {
  const agenda = useAgenda();
  const members = useMemo(() => groupMembers(assignments), [assignments]);
  const musicianIdsKey = members.map((member) => member.musicianId).join(',');

  const [historyByMusician, setHistoryByMusician] = useState<Map<string, MusicianEventHistory>>(
    new Map(),
  );
  const [period, setPeriod] = useState<MusicianHistoryPeriod>('year');
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMember, setOpenMember] = useState<GroupMember | null>(null);
  const [nameQuery, setNameQuery] = useState('');
  const [memberSort, setMemberSort] = useState<GroupHistoryMemberSort>(
    DEFAULT_GROUP_HISTORY_MEMBER_SORT,
  );

  const historyFilterSelectClass =
    'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary';

  const visibleMembers = useMemo(
    () => members.filter((member) => matchesSearchText(member.musicianName, nameQuery)),
    [members, nameQuery],
  );

  useEffect(() => {
    if (isOfflineReadOnly) {
      setHistoryByMusician(new Map());
      setIsLoading(false);
      setError(null);
      return;
    }

    const musicianIds = musicianIdsKey ? musicianIdsKey.split(',') : [];
    if (musicianIds.length === 0) {
      setHistoryByMusician(new Map());
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const result = await agenda.getMusiciansEventHistory(organizationId, musicianIds);
      if (cancelled) {
        return;
      }
      setIsLoading(false);
      if (!result.ok) {
        setHistoryByMusician(new Map());
        setError(agendaErrorMessage(result.error));
        return;
      }
      setHistoryByMusician(result.value);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [agenda, isOfflineReadOnly, organizationId, musicianIdsKey]);

  const periodEventsByMusician = useMemo(() => {
    const result = new Map<string, MusicianEventHistory['events']>();
    for (const [musicianId, history] of historyByMusician) {
      result.set(
        musicianId,
        history.events.filter((event) => musicianEventStartsInPeriod(event.startsAt, period)),
      );
    }
    return result;
  }, [historyByMusician, period]);

  const typeOptions = useMemo(
    () => historyTypeOptions([...periodEventsByMusician.values()].flat()),
    [periodEventsByMusician],
  );

  const activeTypeIds = useMemo(
    () => activeHistoryTypeIds(selectedTypeIds, typeOptions),
    [selectedTypeIds, typeOptions],
  );

  const summaries = useMemo(() => {
    const selectedSet = new Set(activeTypeIds);
    const result = new Map<string, { events: number; absences: number }>();
    for (const [musicianId, events] of periodEventsByMusician) {
      const filtered =
        selectedSet.size === 0 ? events : events.filter((event) => selectedSet.has(event.typeId));
      result.set(musicianId, {
        events: filtered.length,
        absences: filtered.filter((event) => event.wasAbsent).length,
      });
    }
    return result;
  }, [periodEventsByMusician, activeTypeIds]);

  const listedMembers = useMemo(
    () => sortGroupHistoryMembers(visibleMembers, summaries, memberSort),
    [visibleMembers, summaries, memberSort],
  );

  const statLabels = historyPeriodStatLabels(period);

  if (isOfflineReadOnly) {
    return (
      <p className="text-sm text-muted">
        O histórico de eventos não está disponível no modo offline.
      </p>
    );
  }

  return (
    <section className="flex flex-col">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          type="search"
          value={nameQuery}
          onChange={(event) => setNameQuery(event.target.value)}
          placeholder="Buscar por nome"
          aria-label="Filtrar músicos por nome"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
        <label className="min-w-0 sm:w-44">
          <span className="sr-only">Ordenar</span>
          <select
            aria-label="Ordenar"
            value={memberSort}
            onChange={(event) => setMemberSort(event.target.value as GroupHistoryMemberSort)}
            className={historyFilterSelectClass}
          >
            {GROUP_HISTORY_MEMBER_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <EventHistoryFilters
        period={period}
        onPeriodChange={setPeriod}
        typeOptions={typeOptions}
        selectedTypeIds={selectedTypeIds}
        onToggleType={(typeId) =>
          setSelectedTypeIds((current) =>
            current.includes(typeId)
              ? current.filter((id) => id !== typeId)
              : [...current, typeId],
          )
        }
        onClearTypes={() => setSelectedTypeIds([])}
      />

      <div className="mt-4 border-t border-border pt-3">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {members.length === 0 ? (
          <p className="text-sm text-muted">Nenhum integrante neste grupo.</p>
        ) : listedMembers.length === 0 ? (
          <p className="text-sm text-muted">Nenhum músico encontrado com esse nome.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {listedMembers.map((member) => {
              const summary = summaries.get(member.musicianId) ?? { events: 0, absences: 0 };
              const rate = isLoading ? null : absenceRateLabel(summary.absences, summary.events);
              const hasAbsences = !isLoading && summary.absences > 0;

              return (
                <li key={member.musicianId}>
                  <button
                    type="button"
                    onClick={() => setOpenMember(member)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm transition-colors hover:bg-bg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text">{member.musicianName}</p>
                      {member.detailsLabel && (
                        <p className="mt-0.5 text-muted">{member.detailsLabel}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-start gap-4 text-right">
                      <div>
                        <p className="text-lg font-semibold tabular-nums text-text">
                          {isLoading ? '…' : summary.events}
                        </p>
                        <p className="text-xs text-muted" title={statLabels.events}>
                          Eventos
                        </p>
                      </div>
                      <div>
                        <p
                          className={`text-lg font-semibold tabular-nums ${
                            hasAbsences ? 'text-red-600 dark:text-red-400' : 'text-text'
                          }`}
                        >
                          {isLoading ? '…' : summary.absences}
                          {rate && hasAbsences && (
                            <span className="ml-1 text-xs font-medium text-red-800/80 dark:text-red-400/80">
                              {rate}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted" title={statLabels.absences}>
                          Faltas
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={openMember !== null}
        onClose={() => setOpenMember(null)}
        title={openMember?.musicianName ?? ''}
        size="lg"
        headerActions={
          openMember ? (
            <Link
              to={`/${orgSlug}/musicos/${openMember.musicianId}`}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Abrir cadastro
            </Link>
          ) : null
        }
      >
        {openMember && (
          <div
            className="flex flex-col"
            style={{ height: 'min(40rem, calc(var(--app-vh) - 9rem))' }}
          >
            <MusicianHistorySection
              key={openMember.musicianId}
              organizationId={organizationId}
              orgSlug={orgSlug}
              musicianId={openMember.musicianId}
              isOfflineReadOnly={isOfflineReadOnly}
              initialPeriod={period}
              initialTypeIds={activeTypeIds}
              pinnedTypeOptions={typeOptions.filter((type) => activeTypeIds.includes(type.id))}
            />
          </div>
        )}
      </Modal>
    </section>
  );
}
