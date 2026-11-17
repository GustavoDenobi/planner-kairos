import type { MusicianHistoryPeriod } from '@/domain/agenda';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';
import {
  activeHistoryTypeIds,
  HISTORY_PERIODS,
  historyPeriodOptionLabel,
  type HistoryTypeOption,
} from '@/ui/features/ensemble/event-history-filters';

type EventHistoryFiltersProps = {
  period: MusicianHistoryPeriod;
  onPeriodChange: (period: MusicianHistoryPeriod) => void;
  typeOptions: HistoryTypeOption[];
  selectedTypeIds: string[];
  onToggleType: (typeId: string) => void;
  onClearTypes: () => void;
};

export function EventHistoryFilters({
  period,
  onPeriodChange,
  typeOptions,
  selectedTypeIds,
  onToggleType,
  onClearTypes,
}: EventHistoryFiltersProps) {
  const currentYear = new Date().getFullYear();
  const hasActiveTypeFilter = activeHistoryTypeIds(selectedTypeIds, typeOptions).length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Período" className="flex flex-wrap items-center gap-2">
        {HISTORY_PERIODS.map((option) => {
          const selected = period === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onPeriodChange(option)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface text-muted hover:bg-bg hover:text-text'
              }`}
            >
              {historyPeriodOptionLabel(option, currentYear)}
            </button>
          );
        })}
      </div>

      {typeOptions.length > 1 && (
        <div
          role="group"
          aria-label="Filtrar por tipo de evento"
          className="flex flex-wrap items-center gap-2"
        >
          {typeOptions.map((type) => {
            const selected = selectedTypeIds.includes(type.id);
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onToggleType(type.id)}
                aria-pressed={selected}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  selected ? '' : 'border border-border bg-surface text-muted hover:bg-bg hover:text-text'
                }`}
                style={selected ? eventTypeBadgeStyle(type) : undefined}
              >
                {type.name}
              </button>
            );
          })}
          {hasActiveTypeFilter && (
            <button
              type="button"
              onClick={onClearTypes}
              className="rounded-full bg-bg px-3 py-1 text-sm font-medium text-muted transition-colors hover:text-text"
            >
              Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
