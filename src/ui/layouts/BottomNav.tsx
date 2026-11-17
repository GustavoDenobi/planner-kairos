import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useOrg } from '@/ui/app/OrgProvider';
import { IconDownload, IconMoreHorizontal } from '@/ui/components/icons';
import { PWA_INSTALL_BANNER_LABEL } from '@/ui/features/pwa/pwa-install-labels';
import { usePwaInstallContext } from '@/ui/features/pwa/PwaInstallContext';
import { useBodyScrollLock } from '@/ui/components/useBodyScrollLock';
import { getNavItemsForOrg, type NavItem } from '@/ui/layouts/nav-config';
import { spacing } from '@/ui/theme/tokens';

type BottomNavProps = {
  orgSlug: string;
};

const itemClass =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-xs font-medium transition-colors';

function isOverflowItem(item: NavItem): boolean {
  return item.mobileOverflow === true || item.adminOnly === true;
}

export function BottomNav({ orgSlug }: BottomNavProps) {
  const { organizations, isPlatformAdmin } = useOrg();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const pwaInstall = usePwaInstallContext();

  const org = organizations.find((o) => o.slug === orgSlug);
  const navItems = getNavItemsForOrg(org, isPlatformAdmin);
  const primaryItems = navItems.filter((item) => !isOverflowItem(item));
  const overflowItems = navItems.filter(isOverflowItem);

  const isOverflowActive = overflowItems.some((item) => {
    const base = `/${orgSlug}/${item.to}`;
    return pathname === base || pathname.startsWith(`${base}/`);
  });

  useBodyScrollLock(moreOpen);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <div
          className="fixed inset-x-0 top-0 z-20 md:hidden"
          style={{ bottom: spacing.bottomNavOffset }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id="bottom-nav-more"
            role="menu"
            aria-label="Mais opções de navegação"
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-2 shadow-lg"
            style={{
              paddingLeft: 'max(0.5rem, var(--safe-area-left))',
              paddingRight: 'max(0.5rem, var(--safe-area-right))',
            }}
          >
            <ul className="flex flex-col">
              {overflowItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={`/${orgSlug}/${item.to}`}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                        isActive ? 'bg-bg text-primary' : 'text-text hover:bg-bg',
                      ].join(' ')
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
              {/* Atalho fixo: o banner de instalação some por 30 dias quando fechado. */}
              {pwaInstall.installable ? (
                <li className="mt-1 border-t border-border pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      pwaInstall.openModal();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-text transition-colors hover:bg-bg"
                  >
                    <IconDownload className="h-5 w-5 shrink-0 text-primary" />
                    <span>{PWA_INSTALL_BANNER_LABEL}</span>
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      <nav
        data-app-bottom-nav
        className="fixed inset-x-0 z-30 flex border-t border-border bg-surface md:hidden"
        style={{
          bottom: 0,
          height: spacing.bottomNavOffset,
          paddingBottom: 'var(--safe-area-bottom)',
          paddingLeft: 'var(--safe-area-left)',
          paddingRight: 'var(--safe-area-right)',
        }}
      >
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={`/${orgSlug}/${item.to}`}
            className={({ isActive }) =>
              [itemClass, isActive && !moreOpen ? 'text-primary' : 'text-muted'].join(' ')
            }
          >
            {item.icon}
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
        {overflowItems.length > 0 || pwaInstall.installable ? (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls="bottom-nav-more"
            onClick={() => setMoreOpen((open) => !open)}
            className={[
              itemClass,
              moreOpen || isOverflowActive ? 'text-primary' : 'text-muted',
            ].join(' ')}
          >
            <IconMoreHorizontal className="h-5 w-5 shrink-0" />
            <span className="max-w-full truncate">Mais</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}
