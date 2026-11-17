import type { EventListItem, MusicianBirthdayItem } from '@/domain/agenda';
import {
  formatDayHeader,
  groupAgendaItemsByDay,
} from '@/ui/features/agenda/agenda-date';
import { AgendaBirthdayCard } from '@/ui/features/agenda/AgendaBirthdayCard';
import { AgendaEventCard } from '@/ui/features/agenda/AgendaEventCard';
import { AgendaPracticeTaskCard } from '@/ui/features/agenda/AgendaPracticeTaskCard';
import type { AgendaPracticeTaskItem } from '@/ui/features/agenda/agenda-practice-tasks';
import { AgendaEventsListSkeleton } from '@/ui/components/skeletons/page-list-skeletons';

type AgendaEventsSectionProps = {
  orgSlug: string;
  events: EventListItem[];
  birthdays?: MusicianBirthdayItem[];
  tasks?: AgendaPracticeTaskItem[];
  isLoading: boolean;
};

export function AgendaEventsSection({
  orgSlug,
  events,
  birthdays = [],
  tasks = [],
  isLoading,
}: AgendaEventsSectionProps) {
  const grouped = groupAgendaItemsByDay(events, birthdays, tasks);

  if (isLoading) {
    return <AgendaEventsListSkeleton />;
  }

  if (grouped.length === 0) {
    return <p className="text-sm text-muted">Nenhum evento neste período.</p>;
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ date, birthdays: dayBirthdays, tasks: dayTasks, events: dayEvents }) => (
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
            {dayTasks.map((task) => (
              <li key={`task-${task.key}`}>
                <AgendaPracticeTaskCard orgSlug={orgSlug} item={task} />
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
