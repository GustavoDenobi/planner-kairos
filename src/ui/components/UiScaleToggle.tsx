import { useUiScale } from '@/ui/app/useUiScale';
import { getUiScaleLabel } from '@/ui/app/useUiScaleState';
import { IconTextSize } from '@/ui/components/icons';

type UiScaleToggleProps = {
  variant?: 'sidebar' | 'compact' | 'menu-item';
};

function getButtonClass(variant: UiScaleToggleProps['variant']) {
  if (variant === 'compact') {
    return 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-text transition-colors hover:bg-bg';
  }

  if (variant === 'menu-item') {
    return 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-text transition-colors hover:bg-bg';
  }

  return 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-bg hover:text-text';
}

export function UiScaleToggle({ variant = 'sidebar' }: UiScaleToggleProps) {
  const { scale, cycleScale } = useUiScale();
  const label = getUiScaleLabel(scale);

  return (
    <button
      type="button"
      onClick={cycleScale}
      className={getButtonClass(variant)}
      aria-label={`Tamanho ${label.toLowerCase()}. Toque para alterar.`}
    >
      <IconTextSize className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
