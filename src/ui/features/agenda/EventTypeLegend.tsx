import type { EventType } from '@/domain/agenda';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';

type EventTypeLegendProps = {
  types: EventType[];
};

export function EventTypeLegend({ types }: EventTypeLegendProps) {
  if (types.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {types.map((type) => {
        const style = eventTypeBadgeStyle(type);
        return (
          <span
            key={type.id}
            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={style}
          >
            {type.name}
          </span>
        );
      })}
    </div>
  );
}
