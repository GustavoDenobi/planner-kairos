import type { EventType } from '@/domain/agenda';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { IconPencil } from '@/ui/components/icons';
import { eventKindLabel } from '@/ui/features/agenda/agenda-labels';

type AgendaEventTypesSectionProps = {
  types: EventType[];
  onCreate: () => void;
  onEdit: (eventType: EventType) => void;
};

export function AgendaEventTypesSection({
  types,
  onEdit,
}: AgendaEventTypesSectionProps) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {types.map((eventType) => (
          <li
            key={eventType.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <div className="min-w-0">
              <CategoryBadge
                label={eventType.name}
                color={eventType.color}
                slug={eventType.kind}
              />
              <p className="mt-1 text-xs text-muted">{eventKindLabel(eventType.kind)}</p>
            </div>
            <button
              type="button"
              onClick={() => onEdit(eventType)}
              className="shrink-0 text-muted hover:text-text"
              aria-label={`Editar ${eventType.name}`}
            >
              <IconPencil className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
