import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOrg } from '@/ui/app/OrgProvider';
import { IconChevronDown, IconSettings } from '@/ui/components/icons';
import { OrgAvatar } from '@/ui/components/OrgAvatar';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

type OrgPickerDropdownProps = {
  orgSlug: string;
};

export function OrgPickerDropdown({ orgSlug }: OrgPickerDropdownProps) {
  const { organizations, setCurrentOrgBySlug, isOfflineData, isPlatformAdmin } = useOrg();
  const org = organizations.find((item) => item.slug === orgSlug);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnlineStatus();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleSelect(slug: string) {
    if (slug === orgSlug) {
      setOpen(false);
      return;
    }

    const ok = await setCurrentOrgBySlug(slug);
    if (!ok) {
      return;
    }

    setOpen(false);
    const pathAfterOrg = location.pathname.replace(/^\/[^/]+/, '');
    navigate(`/${slug}${pathAfterOrg || '/agenda'}`);
  }

  function handleViewAll() {
    setOpen(false);
    navigate('/orgs');
  }

  async function handleOpenSettings(slug: string) {
    setOpen(false);

    if (slug !== orgSlug) {
      const ok = await setCurrentOrgBySlug(slug);
      if (!ok) {
        return;
      }
    }

    navigate(`/${slug}/configuracao`);
  }

  const label = org?.name ?? orgSlug;

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={organizations.length === 0}
        className="flex min-w-0 max-w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-bg disabled:cursor-default disabled:hover:bg-transparent"
        aria-label="Trocar organização"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {org ? <OrgAvatar organization={org} size="sm" variant="square" /> : null}
        <span className="truncate text-base font-semibold text-text">{label}</span>
        <IconChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && organizations.length > 0 && (
        <div
          className="absolute top-[calc(100%+0.5rem)] z-20 mt-2 w-full rounded-xl border border-border bg-surface p-2 shadow-lg"
          role="listbox"
          aria-label="Organizações"
        >
          <div className="flex flex-col gap-1">
            {organizations.map((item) => {
              const isSelected = item.slug === orgSlug;
              const itemIsAdmin =
                isPlatformAdmin ||
                item.accessRole === 'admin' ||
                item.accessRole === 'owner';
              const itemCanManage = itemIsAdmin && online && !isOfflineData;

              return (
                <div
                  key={item.id}
                  className={[
                    'flex items-center gap-1 rounded-lg pr-1',
                    isSelected ? 'bg-primary/10' : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => void handleSelect(item.slug)}
                    className={[
                      'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      isSelected ? 'text-primary' : 'text-text hover:bg-bg',
                    ].join(' ')}
                  >
                    <OrgAvatar organization={item} size="sm" variant="square" />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                  </button>
                  {itemCanManage && (
                    <button
                      type="button"
                      onClick={() => void handleOpenSettings(item.slug)}
                      className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-bg hover:text-text"
                      aria-label={`Configurações de ${item.name}`}
                    >
                      <IconSettings className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1 border-t border-border pt-2">
            <button
              type="button"
              onClick={handleViewAll}
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-bg hover:text-primary"
            >
              Ver organizações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
