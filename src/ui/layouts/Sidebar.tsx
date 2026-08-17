import { NavLink } from 'react-router-dom';
import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { spacing } from '@/ui/theme/tokens';

type SidebarProps = {
  orgSlug: string;
};

const navItems = [
  { to: 'agenda', label: 'Agenda' },
  { to: 'repertorio', label: 'Repertório' },
  { to: 'musicos', label: 'Músicos' },
] as const;

export function Sidebar({ orgSlug }: SidebarProps) {
  return (
    <aside
      className="hidden h-screen flex-col border-r border-border bg-surface md:flex"
      style={{ width: spacing.sidebarWidth }}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Organização
          </p>
          <p className="text-lg font-semibold text-text">{orgSlug}</p>
        </div>
        <ThemeToggle />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={`/${orgSlug}/${item.to}`}
            className={({ isActive }) =>
              [
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-bg hover:text-text',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
