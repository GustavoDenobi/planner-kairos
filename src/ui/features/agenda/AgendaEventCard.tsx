import { Link } from 'react-router-dom';
import type { EventListItem } from '@/domain/agenda';
import { eventDisplayTitle } from '@/domain/agenda';
import { eventPath } from '@/ui/features/agenda/agenda-routes';
import { formatEventTime } from '@/ui/features/agenda/agenda-date';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';
import { EventAudienceChips } from '@/ui/features/agenda/EventAudienceChips';

type AgendaEventCardProps = {
  orgSlug: string;
  event: EventListItem;
  variant?: 'list' | 'columns';
};

export function AgendaEventCard({ orgSlug, event, variant = 'list' }: AgendaEventCardProps) {
  const title = eventDisplayTitle(event, { name: event.typeName });
  const badgeStyle = eventTypeBadgeStyle({
    kind: event.typeKind,
    color: event.typeColor,
    name: event.typeName,
  });

  return (
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
            {variant === 'columns' ? (
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: badgeStyle.backgroundColor }}
                title={event.typeName}
                aria-label={event.typeName}
              />
            ) : (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={badgeStyle}>
                {event.typeName}
              </span>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {formatEventTime(event.startsAt, event.endsAt)}
        </p>
        {event.programCount > 0 && (
          <p className="mt-1 text-xs text-muted">
            {event.programCount} {event.programCount === 1 ? 'peça' : 'peças'} na programação
          </p>
        )}
        <EventAudienceChips groups={event.groups} musicians={event.musicians} singleLine />
      </div>
    </Link>
  );
}
