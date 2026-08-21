import { useCallback, useEffect, useState } from 'react';
import type { EventAbsencesSnapshot } from '@/application/agenda/event-absence-use-cases';
import type { EventAudienceGroup, EventAudienceMusician } from '@/domain/agenda';
import { useAgenda } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { agendaErrorMessage } from '@/ui/features/agenda/agenda-labels';

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

  if (isLoading) {
    return <p className="text-sm text-muted">Carregando chamada…</p>;
  }

  if (error && !snapshot) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  const participants = snapshot?.participants ?? [];
  const absentMusicianIds = new Set(snapshot?.absentMusicianIds ?? []);
  const absentCount = absentMusicianIds.size;

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
        <ul className="flex flex-col gap-2">
          {participants.map((participant) => {
            const isAbsent = absentMusicianIds.has(participant.musicianId);
            const isToggling = togglingMusicianId === participant.musicianId;

            return (
              <li key={participant.musicianId}>
                <button
                  type="button"
                  disabled={disabled || isToggling}
                  onClick={() => void handleToggle(participant.musicianId)}
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
      )}
    </section>
  );
}
