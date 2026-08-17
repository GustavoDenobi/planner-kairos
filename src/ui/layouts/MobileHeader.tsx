import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { spacing } from '@/ui/theme/tokens';

type MobileHeaderProps = {
  title: string;
};

export function MobileHeader({ title }: MobileHeaderProps) {
  return (
    <header
      className="flex items-center justify-between border-b border-border bg-surface px-4 md:hidden"
      style={{ height: spacing.headerHeight }}
    >
      <div>
        <p className="text-xs text-muted">Planner Kairós</p>
        <h1 className="text-base font-semibold text-text">{title}</h1>
      </div>
      <ThemeToggle />
    </header>
  );
}
