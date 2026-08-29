import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlatformUserSummary } from '@/domain/platform/plan';
import { usePlatform } from '@/ui/app/AppServicesContext';
import { InitialsAvatar } from '@/ui/components/InitialsAvatar';
import {
  AdminPageShell,
  adminEmptyStateClass,
  adminFieldClass,
  adminListClass,
  adminListItemClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from '@/ui/features/platform/admin-page-shell';
import { platformErrorMessage } from '@/ui/features/platform/platform-labels';

const PAGE_SIZE = 25;

export function PlatformUsersPage() {
  const platform = usePlatform();
  const [users, setUsers] = useState<PlatformUserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, [query, offset]);

  async function loadUsers() {
    setIsLoading(true);
    setError(null);

    const result = await platform.listUsers(query || null, PAGE_SIZE, offset);

    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    setUsers(result.value);
    setTotalCount(result.value[0]?.totalCount ?? 0);
    setIsLoading(false);
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setOffset(0);
    setQuery(search.trim());
  }

  return (
    <AdminPageShell
      title="Usuários"
      subtitle={`${totalCount} cadastrados`}
      toolbar={
        <form onSubmit={handleSearch} className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Buscar usuários</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className={adminFieldClass}
            />
          </label>
          <button type="submit" className={adminPrimaryButtonClass}>
            Buscar
          </button>
        </form>
      }
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className={adminEmptyStateClass}>Carregando usuários…</p>
      ) : users.length === 0 ? (
        <p className={adminEmptyStateClass}>Nenhum usuário encontrado.</p>
      ) : (
        <ul className={adminListClass}>
          {users.map((user) => (
            <li key={user.id}>
              <Link to={`/admin/usuarios/${user.id}`} className={`${adminListItemClass} block`}>
                <InitialsAvatar name={user.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text">{user.displayName}</p>
                  <p className="truncate text-sm text-muted">{user.email}</p>
                </div>
                <span className="shrink-0 text-sm text-muted">
                  {user.membershipsCount}{' '}
                  {user.membershipsCount === 1 ? 'organização' : 'organizações'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalCount > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
            className={adminSecondaryButtonClass}
          >
            Anterior
          </button>
          <span className="text-sm text-muted">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} de {totalCount}
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= totalCount}
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
            className={adminSecondaryButtonClass}
          >
            Próxima
          </button>
        </div>
      )}
    </AdminPageShell>
  );
}
