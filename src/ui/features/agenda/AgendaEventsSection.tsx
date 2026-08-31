import type { EventListItem, MusicianBirthdayItem } from '@/domain/agenda';
import {
  formatDayHeader,
  groupAgendaItemsByDay,
} from '@/ui/features/agenda/agenda-date';
import { AgendaBirthdayCard } from '@/ui/features/agenda/AgendaBirthdayCard';
import { AgendaEventCard } from '@/ui/features/agenda/AgendaEventCard';

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
                <AgendaBirthdayCard orgSlug={orgSlug} birthday={birthday} />
              </li>
            ))}
            {dayEvents.map((event) => (
              <li key={event.id}>
                <AgendaEventCard orgSlug={orgSlug} event={event} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
