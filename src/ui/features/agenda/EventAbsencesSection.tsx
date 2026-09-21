import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventAbsencesSnapshot } from '@/application/agenda/event-absence-use-cases';
import type {
  AbsenceGroupingMode,
  EventAudienceGroup,
  EventAudienceMusician,
  EventParticipant,
} from '@/domain/agenda';
import { groupEventParticipants } from '@/domain/agenda';
import { IconChevronDown } from '@/ui/components/icons';
import { useAgenda } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { agendaErrorMessage } from '@/ui/features/agenda/agenda-labels';

type PresenceFilter = 'all' | 'absent' | 'present';

const selectClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text';

type EventAbsencesSectionProps = {
  organizationId: string;
  eventId: string;
  groups: EventAudienceGroup[];
  musicians: EventAudienceMusician[];
  disabled?: boolean;
};

function participantCardClass(isAbsent: boolean, disabled: boolean): string {
  const base =
    'flex w-full items-center rounded-lg border py-3 px-4 text-left text-sm transition-colors';
  if (isAbsent) {
    return `${base} border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 ${
      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50'
    }`;
  }
  return `${base} border-border bg-surface ${
    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-bg'
  }`;
}

export function EventAbsencesSection({
  organizationId,
  eventId,
  groups,
  musicians,
  disabled = false,
}: EventAbsencesSectionProps) {
  const agenda = useAgenda();
  const { userId } = useAuth();
  const [snapshot, setSnapshot] = useState<EventAbsencesSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingMusicianId, setTogglingMusicianId] = useState<string | null>(null);
  const [grouping, setGrouping] = useState<AbsenceGroupingMode>('name');
  const [presence, setPresence] = useState<PresenceFilter>('all');
  const [collapsedBucketIds, setCollapsedBucketIds] = useState<Set<string>>(() => new Set());

  const loadAbsences = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    const result = await agenda.listEventAbsences(organizationId, userId, eventId);

    setIsLoading(false);

    if (!result.ok) {
      setError(agendaErrorMessage(result.error));
      return;
    }

    setSnapshot(result.value);
  }, [agenda, organizationId, userId, eventId]);

  useEffect(() => {
    void loadAbsences();
  }, [loadAbsences, groups, musicians]);

  async function handleToggle(musicianId: string) {
    if (disabled || !userId || togglingMusicianId) {
      return;
    }

    const previousSnapshot = snapshot;
    const wasAbsent = previousSnapshot?.absentMusicianIds.includes(musicianId) ?? false;

    setTogglingMusicianId(musicianId);
    setError(null);

    if (previousSnapshot) {
      setSnapshot({
        ...previousSnapshot,
        absentMusicianIds: wasAbsent
          ? previousSnapshot.absentMusicianIds.filter((id) => id !== musicianId)
          : [...previousSnapshot.absentMusicianIds, musicianId],
      });
    }

    const result = await agenda.toggleEventAbsence(
      organizationId,
      userId,
      eventId,
      musicianId,
    );

    setTogglingMusicianId(null);

    if (!result.ok) {
      setSnapshot(previousSnapshot);
      setError(agendaErrorMessage(result.error));
      return;
    }

    setSnapshot(result.value);
  }

  const participants = useMemo(() => snapshot?.participants ?? [], [snapshot?.participants]);
  const absentMusicianIds = useMemo(
    () => new Set(snapshot?.absentMusicianIds ?? []),
    [snapshot?.absentMusicianIds],
  );
  const absentCount = absentMusicianIds.size;
  const visibleParticipants = useMemo(() => {
    if (presence === 'all') {
      return participants;
    }
    return participants.filter((participant) => {
      const isAbsent = absentMusicianIds.has(participant.musicianId);
      return presence === 'absent' ? isAbsent : !isAbsent;
    });
  }, [participants, presence, absentMusicianIds]);
  const buckets = useMemo(
    () => groupEventParticipants(visibleParticipants, grouping, groups.length),
    [visibleParticipants, grouping, groups.length],
  );

  if (isLoading) {
    return <p className="text-sm text-muted">Carregando chamada…</p>;
  }

  if (error && !snapshot) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  function handleGroupingChange(next: AbsenceGroupingMode) {
    setGrouping(next);
    setCollapsedBucketIds(new Set());
  }

  function toggleBucket(bucketId: string) {
    setCollapsedBucketIds((current) => {
      const next = new Set(current);
      if (next.has(bucketId)) {
        next.delete(bucketId);
      } else {
        next.add(bucketId);
      }
      return next;
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm text-muted">
          Participantes: {participants.length}
        </p>
        <p className="text-sm text-muted">
          Ausentes: {absentCount}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {participants.length === 0 ? (
        <p className="text-sm text-muted">Nenhum participante associado a este evento.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Agrupar por</span>
              <select
                value={grouping}
                onChange={(event) => handleGroupingChange(event.target.value as AbsenceGroupingMode)}
                className={selectClass}
              >
                <option value="name">Nome</option>
                <option value="section">Naipe</option>
                <option value="part">Parte</option>
                <option value="group">Grupo</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Mostrar</span>
              <select
                value={presence}
                onChange={(event) => setPresence(event.target.value as PresenceFilter)}
                className={selectClass}
              >
                <option value="all">Todos</option>
                <option value="absent">Ausentes</option>
                <option value="present">Presentes</option>
              </select>
            </label>
          </div>

          {visibleParticipants.length === 0 ? (
            <p className="text-sm text-muted">
              {presence === 'absent'
                ? 'Nenhum ausente nesta chamada.'
                : 'Nenhum presente nesta chamada.'}
            </p>
          ) : grouping === 'name' ? (
            <ParticipantList
              participants={visibleParticipants}
              absentMusicianIds={absentMusicianIds}
              togglingMusicianId={togglingMusicianId}
              disabled={disabled}
              onToggle={handleToggle}
            />
          ) : (
            <div className="space-y-3">
              {buckets.map((bucket, index) => {
                const expanded = !collapsedBucketIds.has(bucket.id);
                const panelId = `absence-bucket-${index}`;
                const bucketAbsentCount = bucket.participants.filter((participant) =>
                  absentMusicianIds.has(participant.musicianId),
                ).length;

                return (
                  <div key={bucket.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => toggleBucket(bucket.id)}
                    >
                      <IconChevronDown
                        className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                          expanded ? '' : '-rotate-90'
                        }`}
                      />
                      <span className="min-w-0 flex-1 font-medium text-text">{bucket.label}</span>
                      <span className="shrink-0 text-sm text-muted">
                        {formatBucketCount(bucketAbsentCount, bucket.participants.length)}
                      </span>
                    </button>
                    {expanded && (
                      <ParticipantList
                        id={panelId}
                        participants={bucket.participants}
                        absentMusicianIds={absentMusicianIds}
                        togglingMusicianId={togglingMusicianId}
                        disabled={disabled}
                        onToggle={handleToggle}
                        keyPrefix={bucket.id}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function formatBucketCount(absent: number, total: number): string {
  const absentLabel = absent === 1 ? '1 ausente' : `${absent} ausentes`;
  return `${absentLabel} de ${total}`;
}

function ParticipantList({
  id,
  participants,
  absentMusicianIds,
  togglingMusicianId,
  disabled,
  onToggle,
  keyPrefix = '',
}: {
  id?: string;
  participants: EventParticipant[];
  absentMusicianIds: Set<string>;
  togglingMusicianId: string | null;
  disabled: boolean;
  onToggle: (musicianId: string) => void;
  keyPrefix?: string;
}) {
  return (
    <ul id={id} className="flex flex-col gap-2">
      {participants.map((participant) => {
        const isAbsent = absentMusicianIds.has(participant.musicianId);
        const isToggling = togglingMusicianId === participant.musicianId;

        return (
          <li key={`${keyPrefix}${participant.musicianId}`}>
            <button
              type="button"
              disabled={disabled || isToggling}
              onClick={() => {
                void onToggle(participant.musicianId);
              }}
              className={participantCardClass(isAbsent, disabled || isToggling)}
              aria-pressed={isAbsent}
            >
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${isAbsent ? 'text-red-700 dark:text-red-300' : 'text-text'}`}>
                  {participant.fullName}
                </p>
                {participant.groupNames.length > 0 && (
                  <p className={`mt-0.5 ${isAbsent ? 'text-red-600/80 dark:text-red-400/80' : 'text-muted'}`}>
                    {participant.groupNames.join(', ')}
                  </p>
                )}
                {participant.partNames.length > 0 && (
                  <p className={`mt-0.5 ${isAbsent ? 'text-red-600/80 dark:text-red-400/80' : 'text-muted'}`}>
                    {participant.partNames.join(', ')}
                  </p>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
