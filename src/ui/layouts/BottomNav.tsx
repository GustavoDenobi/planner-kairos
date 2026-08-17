import { NavLink } from 'react-router-dom';
import { spacing } from '@/ui/theme/tokens';

type BottomNavProps = {
  orgSlug: string;
};

const navItems = [
  { to: 'agenda', label: 'Agenda' },
  { to: 'repertorio', label: 'Repertório' },
  { to: 'musicos', label: 'Músicos' },
] as const;

export function BottomNav({ orgSlug }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface md:hidden"
      style={{ height: spacing.bottomNavHeight }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={`/${orgSlug}/${item.to}`}
          className={({ isActive }) =>
            [
              'flex flex-1 flex-col items-center justify-center text-xs font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
