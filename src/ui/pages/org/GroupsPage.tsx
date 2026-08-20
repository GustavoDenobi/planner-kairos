import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import type { GroupKind, GroupListItem } from '@/domain/ensemble';
import { useEnsemble, useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { Modal } from '@/ui/components/Modal';
import { IconUsers } from '@/ui/components/icons';
import { GROUP_KIND_OPTIONS } from '@/ui/features/ensemble/group-labels';
import { GroupKindIcon } from '@/ui/features/ensemble/group-icons';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { OrgListPageLayout } from '@/ui/layouts/OrgListPageLayout';
import { matchesSearchText } from '@/ui/utils/normalize-search-text';

function sortGroups(groups: GroupListItem[]) {
  const active = groups
    .filter((g) => !g.archivedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
  const archived = groups
    .filter((g) => g.archivedAt)
    .sort((a, b) => b.archivedAt!.getTime() - a.archivedAt!.getTime());
  return { active, archived };
}

export function GroupsPage() {
  const { orgSlug } = useParams();
  const ensemble = useEnsemble();
  const offline = useOffline();
  const { userId } = useAuth();
  const online = useOnlineStatus();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);
  const isOfflineReadOnly = !online;

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offlineCachedAt, setOfflineCachedAt] = useState<string | null>(null);
  useLoadingBar('groups', isLoading);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind>('ensemble');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  const { active: activeGroups, archived: archivedGroups } = sortGroups(groups);
  const filteredActiveGroups = useMemo(
    () => activeGroups.filter((group) => matchesSearchText(group.name, searchQuery)),
    [activeGroups, searchQuery],
  );
  const filteredArchivedGroups = useMemo(
    () => archivedGroups.filter((group) => matchesSearchText(group.name, searchQuery)),
    [archivedGroups, searchQuery],
  );

  useEffect(() => {
    if (!org || !userId) {
      return;
    }

    setIsLoading(true);

    if (!isBrowserOnline()) {
      void offline
        .listCachedGroups(org.id, userId, { includeArchived: true })
        .then((cached) => {
          setGroups(cached.groups);
          setOfflineCachedAt(cached.cachedAt);
          setIsLoading(false);
        });
      return;
    }

    setOfflineCachedAt(null);
    ensemble.listGroups(org.id, { includeArchived: true }).then((result) => {
      if (result.ok) {
        setGroups(result.value);
      }
      setIsLoading(false);
    });
  }, [ensemble, offline, org, userId]);

  if (!org) {
    return null;
  }

  if (!isAdmin) {
    return <div className="text-muted">Acesso restrito a administradores.</div>;
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await ensemble.createGroup(org!.id, {
      name,
      kind,
      notes: notes || null,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError('Não foi possível criar o grupo. Verifique o nome e tente novamente.');
      return;
    }
    setGroups((prev) =>
      [...prev, { ...result.value, memberCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setCreateOpen(false);
    setName('');
    setKind('ensemble');
    setNotes('');
  }

  function renderGroupItem(group: GroupListItem, archived: boolean) {
    return (
      <li key={group.id}>
        <Link
          to={`/${orgSlug}/grupos/${group.id}`}
          className={`flex items-center justify-between rounded-xl border border-border px-4 py-3 transition-colors ${
            archived
              ? 'bg-bg text-muted hover:bg-surface'
              : 'bg-surface hover:bg-bg'
          }`}
        >
          <div>
            <p className={`flex items-center gap-2 font-medium ${archived ? 'text-muted' : 'text-text'}`}>
              <GroupKindIcon kind={group.kind} className="h-5 w-5 shrink-0 text-muted" />
              {group.name}
            </p>
            {archived && group.archivedAt && (
              <p className="mt-0.5 text-xs text-muted">
                Arquivado em {group.archivedAt.toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm text-muted">
            <IconUsers className="h-4 w-4" />
            {group.memberCount}
          </span>
        </Link>
      </li>
    );
  }

  const visibleGroups = showArchived
    ? [...filteredActiveGroups, ...filteredArchivedGroups]
    : filteredActiveGroups;
  const isEmpty = activeGroups.length === 0 && archivedGroups.length === 0;
  const hasSearchResults = visibleGroups.length > 0;

  return (
    <>
      <OrgListPageLayout
        header={
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-text">Grupos</h1>
              {isOfflineReadOnly && (
                <p className="mt-1 text-sm text-muted">
                  Modo offline — somente leitura
                  {offlineCachedAt
                    ? ` · dados de ${new Intl.DateTimeFormat('pt-BR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(offlineCachedAt))}`
                    : ''}
                </p>
              )}
            </div>
            {!isOfflineReadOnly && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                + Grupo
              </button>
            )}
          </div>
        }
        toolbar={
          !isLoading && !isEmpty ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="sr-only">Buscar grupos</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome…"
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
          ) : undefined
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : isEmpty ? (
          <p className="text-sm text-muted">Nenhum grupo cadastrado.</p>
        ) : !hasSearchResults ? (
          <p className="text-sm text-muted">Nenhum grupo encontrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleGroups.map((group) => renderGroupItem(group, group.archivedAt !== null))}
            {!showArchived && archivedGroups.length > 0 && (
              <li className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className="text-sm text-muted text-center hover:text-text hover:underline"
                >
                  Mostrar arquivados
                </button>
              </li>
            )}
          </ul>
        )}
      </OrgListPageLayout>

      {!isOfflineReadOnly && (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo grupo">
          <form className="flex flex-col gap-4" onSubmit={handleCreate}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Nome</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Tipo</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as GroupKind)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
              >
                {GROUP_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Observações</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Criando…' : 'Criar grupo'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
