import { useTheme } from '@/ui/app/useTheme';
import { IconMoon, IconSun } from '@/ui/components/icons';

type ThemeToggleProps = {
  variant?: 'sidebar' | 'compact' | 'menu-item';
};

function getButtonClass(variant: ThemeToggleProps['variant']) {
  if (variant === 'compact') {
    return 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-text transition-colors hover:bg-bg';
  }

  if (variant === 'menu-item') {
    return 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-text transition-colors hover:bg-bg';
  }

  return 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-bg hover:text-text';
}

export function ThemeToggle({ variant = 'sidebar' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Escuro' : 'Claro';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={getButtonClass(variant)}
      aria-label={`Tema ${label.toLowerCase()}. Toque para alternar.`}
    >
      {isDark ? <IconSun className="h-5 w-5 shrink-0" /> : <IconMoon className="h-5 w-5 shrink-0" />}
      <span>{label}</span>
    </button>
  );
}
