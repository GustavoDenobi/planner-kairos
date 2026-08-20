import { Link } from 'react-router-dom';
import type { EventListItem } from '@/domain/agenda';
import { eventDisplayTitle } from '@/domain/agenda';
import { eventPath } from '@/ui/features/agenda/agenda-routes';
import { formatDayHeader, formatEventTime, groupEventsByDay } from '@/ui/features/agenda/agenda-date';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';
import { EventAudienceChips } from '@/ui/features/agenda/EventAudienceChips';

type AgendaEventsSectionProps = {
  orgSlug: string;
  events: EventListItem[];
  isLoading: boolean;
};

export function AgendaEventsSection({ orgSlug, events, isLoading }: AgendaEventsSectionProps) {
  const grouped = groupEventsByDay(events);

  if (isLoading) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }

  if (grouped.length === 0) {
    return <p className="text-sm text-muted">Nenhum evento neste período.</p>;
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ date, events: dayEvents }) => (
        <section key={date.toISOString()}>
          <h2 className="mb-2 text-sm font-semibold capitalize text-text">
            {formatDayHeader(date)}
          </h2>
          <ul className="space-y-2">
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
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={badgeStyle}
                        >
                          {event.typeName}
                        </span>
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
