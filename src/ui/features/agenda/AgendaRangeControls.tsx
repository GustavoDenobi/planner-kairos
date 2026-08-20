import { IconChevronLeft, IconChevronRight } from '@/ui/components/icons';
import { formatRangeLabel } from '@/ui/features/agenda/agenda-date';

type AgendaRangeControlsProps = {
  anchor: Date;
  onPrevious: () => void;
  onNext: () => void;
};

export function AgendaRangeControls({
  anchor,
  onPrevious,
  onNext,
}: AgendaRangeControlsProps) {
  return (
    <div className="flex w-full items-center justify-between gap-2 md:w-auto md:shrink-0 md:justify-start">
      <button
        type="button"
        onClick={onPrevious}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text hover:bg-bg"
        aria-label="Semana anterior"
      >
        <IconChevronLeft className="h-5 w-5" />
      </button>
      <p className="text-sm font-medium text-text">{formatRangeLabel('week', anchor)}</p>
      <button
        type="button"
        onClick={onNext}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text hover:bg-bg"
        aria-label="Próxima semana"
      >
        <IconChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
