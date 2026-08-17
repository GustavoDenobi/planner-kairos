import { NavLink } from 'react-router-dom';
import { useOrg } from '@/ui/app/OrgProvider';
import { getNavItemsForOrg } from '@/ui/layouts/nav-config';
import { spacing } from '@/ui/theme/tokens';

type BottomNavProps = {
  orgSlug: string;
};

export function BottomNav({ orgSlug }: BottomNavProps) {
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);
  const navItems = getNavItemsForOrg(org);

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
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted',
            ].join(' ')
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
