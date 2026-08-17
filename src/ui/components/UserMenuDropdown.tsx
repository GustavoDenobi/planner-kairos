import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignOut } from '@/ui/app/auth/AuthProvider';
import { IconLogOut } from '@/ui/components/icons';
import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { UserAvatar } from '@/ui/components/UserAvatar';
import { useUserProfile } from '@/ui/hooks/useUserProfile';

export function UserMenuDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const profile = useUserProfile();
  const signOut = useSignOut();
  const navigate = useNavigate();

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

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate('/login');
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full ring-2 ring-transparent transition hover:ring-primary/30"
        aria-label="Menu do usuário"
        aria-expanded={open}
      >
        <UserAvatar size="sm" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium text-text truncate">
              {profile?.displayName ?? 'Usuário'}
            </p>
            {profile?.email && (
              <p className="text-xs text-muted truncate">{profile.email}</p>
            )}
          </div>
          <div className="p-1">
            <ThemeToggle variant="menu-item" />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text hover:bg-bg"
            >
              <IconLogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
