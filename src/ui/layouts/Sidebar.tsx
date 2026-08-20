import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useOrg } from '@/ui/app/OrgProvider';
import { useSignOut } from '@/ui/app/auth/AuthProvider';
import { IconLogOut, IconSettings } from '@/ui/components/icons';
import { OrgAvatar } from '@/ui/components/OrgAvatar';
import { DisplayPreferencesControls } from '@/ui/components/DisplayPreferencesControls';
import { UserAvatar } from '@/ui/components/UserAvatar';
import { OrganizationEditModal } from '@/ui/features/identity/OrganizationEditModal';
import { useUserProfile } from '@/ui/hooks/useUserProfile';
import { getNavItemsForOrg } from '@/ui/layouts/nav-config';
import { spacing } from '@/ui/theme/tokens';
import { useState } from 'react';

type SidebarProps = {
  orgSlug: string;
};

export function Sidebar({ orgSlug }: SidebarProps) {
  const { organizations, refreshOrganizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);
  const profile = useUserProfile();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  const navItems = getNavItemsForOrg(org);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <aside
      className="hidden h-dvh flex-col border-r border-border bg-surface md:flex"
      style={{ width: spacing.sidebarWidth }}
    >
      <div className="border-b border-border px-4 py-4">
        {org && (
          <div className="flex items-start gap-3">
            <OrgAvatar organization={org} size="lg" variant="square" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="truncate font-semibold text-text">{org.name}</p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="shrink-0 rounded-lg p-1 text-muted hover:bg-bg hover:text-text"
                    aria-label="Editar organização"
                  >
                    <IconSettings className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Link
                to="/orgs"
                className="mt-1 text-xs text-muted hover:text-primary hover:underline"
              >
                Trocar organização
              </Link>
            </div>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={`/${orgSlug}/${item.to}`}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-bg hover:text-text',
              ].join(' ')
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-1 py-2">
          <UserAvatar size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">
              {profile?.displayName ?? 'Usuário'}
            </p>
            {profile?.email && (
              <p className="truncate text-xs text-muted">{profile.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="shrink-0 rounded-lg p-2 text-muted hover:bg-bg hover:text-text"
            aria-label="Sair"
          >
            <IconLogOut className="h-5 w-5" />
          </button>
        </div>
        <DisplayPreferencesControls />
      </div>

      {org && isAdmin && (
        <OrganizationEditModal
          organization={org}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onUpdated={() => refreshOrganizations()}
        />
      )}
    </aside>
  );
}
