import { useTheme } from '@/ui/app/useTheme';
import { IconMoon, IconSun } from '@/ui/components/icons';

type ThemeToggleProps = {
  variant?: 'sidebar' | 'compact' | 'menu-item';
};

export function ThemeToggle({ variant = 'sidebar' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text hover:bg-bg"
      >
        {isDark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
        <span>{isDark ? 'Tema claro' : 'Tema escuro'}</span>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-bg"
        aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      >
        {isDark ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
        <span>{isDark ? 'Claro' : 'Escuro'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-bg hover:text-text"
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      {isDark ? <IconSun className="h-5 w-5 shrink-0" /> : <IconMoon className="h-5 w-5 shrink-0" />}
      <span>{isDark ? 'Tema claro' : 'Tema escuro'}</span>
    </button>
  );
}
