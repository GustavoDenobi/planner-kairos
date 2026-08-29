import { Link } from 'react-router-dom';
import type { EventListItem, MusicianBirthdayItem } from '@/domain/agenda';
import { eventDisplayTitle } from '@/domain/agenda';
import { eventPath } from '@/ui/features/agenda/agenda-routes';
import {
  formatDayHeader,
  formatEventTime,
  groupAgendaItemsByDay,
} from '@/ui/features/agenda/agenda-date';
import {
  birthdayCardTitle,
  formatBirthdayAssignmentLabel,
} from '@/ui/features/agenda/agenda-labels';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';
import { EventAudienceChips } from '@/ui/features/agenda/EventAudienceChips';

type AgendaEventsSectionProps = {
  orgSlug: string;
  events: EventListItem[];
  birthdays?: MusicianBirthdayItem[];
  isLoading: boolean;
};

export function AgendaEventsSection({
  orgSlug,
  events,
  birthdays = [],
  isLoading,
}: AgendaEventsSectionProps) {
  const grouped = groupAgendaItemsByDay(events, birthdays);

  if (isLoading) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }

  if (grouped.length === 0) {
    return <p className="text-sm text-muted">Nenhum evento neste período.</p>;
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ date, birthdays: dayBirthdays, events: dayEvents }) => (
        <section key={date.toISOString()}>
          <h2 className="mb-2 text-sm font-semibold capitalize text-text">
            {formatDayHeader(date)}
          </h2>
          <ul className="space-y-2">
            {dayBirthdays.map((birthday) => (
              <li key={`birthday-${birthday.musicianId}-${birthday.date}`}>
                <Link
                  to={`/${orgSlug}/musicos/${birthday.musicianId}`}
                  className="block max-w-full overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg"
                >
                  <div className="min-w-0 max-w-full">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-medium text-text">
                        {birthdayCardTitle(birthday.fullName, birthday.ageTurning)}
                      </p>
                      <span className="shrink-0 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium text-pink-800 dark:bg-pink-950 dark:text-pink-200">
                        Aniversário
                      </span>
                    </div>
                    {birthday.assignments.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-sm text-muted">
                        {birthday.assignments.map((assignment) => (
                          <li key={`${birthday.musicianId}-${assignment.groupId}-${assignment.partName ?? assignment.sectionName ?? assignment.ensembleRole}`}>
                            {formatBirthdayAssignmentLabel(assignment)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Link>
              </li>
            ))}
            {dayEvents.map((event) => {
              const title = eventDisplayTitle(event, { name: event.typeName });
              const badgeStyle = eventTypeBadgeStyle({
                kind: event.typeKind,
                color: event.typeColor,
                name: event.typeName,
              });

              return (
                <li key={event.id}>
                  <Link
                    to={eventPath(orgSlug, event.id)}
                    className="block max-w-full overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg"
                  >
                    <div className="min-w-0 max-w-full">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate font-medium text-text">{title}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          {event.recurrenceId && (
                            <span
                              className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-muted"
                              title="Evento recorrente"
                            >
                              ↻
                            </span>
                          )}
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={badgeStyle}
                          >
                            {event.typeName}
                          </span>
                        </div>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatEventTime(event.startsAt, event.endsAt)}
                      </p>
                      {event.programCount > 0 && (
                        <p className="mt-1 text-xs text-muted">
                          {event.programCount}{' '}
                          {event.programCount === 1 ? 'peça' : 'peças'} na programação
                        </p>
                      )}
                      <EventAudienceChips
                        groups={event.groups}
                        musicians={event.musicians}
                        singleLine
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
