import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { UiScaleToggle } from '@/ui/components/UiScaleToggle';

type DisplayPreferencesControlsProps = {
  variant?: 'sidebar' | 'compact' | 'menu-item';
};

function getContainerClass(variant: DisplayPreferencesControlsProps['variant']) {
  if (variant === 'sidebar') {
    return 'flex items-center justify-center gap-1';
  }

  return 'flex items-center gap-1';
}

export function DisplayPreferencesControls({
  variant = 'sidebar',
}: DisplayPreferencesControlsProps) {
  return (
    <div className={getContainerClass(variant)}>
      <UiScaleToggle variant={variant} />
      <ThemeToggle variant={variant} />
    </div>
  );
}
