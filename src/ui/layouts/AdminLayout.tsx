import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useSignOut } from '@/ui/app/auth/AuthProvider';
import { IconLogOut } from '@/ui/components/icons';
import { DisplayPreferencesControls } from '@/ui/components/DisplayPreferencesControls';
import { UserAvatar } from '@/ui/components/UserAvatar';
import { useUserProfile } from '@/ui/hooks/useUserProfile';
import { spacing } from '@/ui/theme/tokens';

const adminNavItems = [
  { to: '/admin/organizacoes', label: 'Organizações' },
  { to: '/admin/usuarios', label: 'Usuários' },
  { to: '/admin/planos', label: 'Planos' },
];

export function AdminLayout() {
  const profile = useUserProfile();
  const signOut = useSignOut();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex min-h-dvh bg-bg">
      <aside
        className="hidden h-dvh flex-col border-r border-border bg-surface md:flex"
        style={{ width: spacing.sidebarWidth }}
      >
        <div className="border-b border-border px-4 py-4">
          <p className="font-brand text-lg font-bold text-text">Administração</p>
          <Link to="/orgs" className="mt-1 text-xs text-muted hover:text-primary hover:underline">
            Voltar ao app
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="border-b border-border bg-surface px-4 py-3 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="font-brand font-bold text-text">Administração</p>
            <Link to="/orgs" className="text-sm text-primary hover:underline">
              App
            </Link>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto">
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-4 py-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
