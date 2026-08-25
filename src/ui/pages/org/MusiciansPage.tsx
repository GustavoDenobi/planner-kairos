import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import type {
  MusicianSortDirection,
  MusicianSortField,
} from '@/application/ports/musician-repository';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import {
  normalizePhone,
  type EnsembleRole,
  type GroupListItem,
  type MusicianListItem,
  type SectionListItem,
} from '@/domain/ensemble';
import { useEnsemble, useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { Modal } from '@/ui/components/Modal';
import { MusicianClaimLinkCopyButton } from '@/ui/components/MusicianClaimLinkCopyButton';
import { IconArrowUpDown, IconFilter, IconWhatsApp } from '@/ui/components/icons';
import { ENSEMBLE_ROLE_OPTIONS } from '@/ui/features/ensemble/ensemble-labels';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { OrgListPageLayout } from '@/ui/layouts/OrgListPageLayout';
import { normalizeSearchText } from '@/ui/utils/normalize-search-text';

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

type SortOption = {
  field: MusicianSortField;
  direction: MusicianSortDirection;
  label: string;
};

const SORT_OPTIONS: SortOption[] = [
  { field: 'created_at', direction: 'desc', label: 'Cadastro (mais recente)' },
  { field: 'created_at', direction: 'asc', label: 'Cadastro (mais antigo)' },
  { field: 'name', direction: 'asc', label: 'Nome (A–Z)' },
  { field: 'name', direction: 'desc', label: 'Nome (Z–A)' },
];

const filterSelectClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text';

function isSameSort(
  a: { field: MusicianSortField; direction: MusicianSortDirection },
  b: { field: MusicianSortField; direction: MusicianSortDirection },
) {
  return a.field === b.field && a.direction === b.direction;
}

function musicianWhatsAppUrl(phone: string | null): string | null {
  if (!phone) {
    return null;
  }
  const digits = normalizePhone(phone);
  if (digits.length === 0) {
    return null;
  }
  return `https://wa.me/55${digits}`;
}

export function MusiciansPage() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const ensemble = useEnsemble();
  const offline = useOffline();
  const { userId } = useAuth();
  const online = useOnlineStatus();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);
  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  const isOfflineReadOnly = !online;

  const [musicians, setMusicians] = useState<MusicianListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offlineCachedAt, setOfflineCachedAt] = useState<string | null>(null);
  useLoadingBar('musicians', isLoading || isLoadingMore);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortField, setSortField] = useState<MusicianSortField>('created_at');
  const [sortDirection, setSortDirection] = useState<MusicianSortDirection>('desc');
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterPartId, setFilterPartId] = useState('');
  const [filterRole, setFilterRole] = useState<EnsembleRole | ''>('');
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [parts, setParts] = useState<PartWithDivisions[]>([]);
  const [sections, setSections] = useState<SectionListItem[]>([]);
  const filtersPanelId = useId();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createFullName, setCreateFullName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createBirthDate, setCreateBirthDate] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const requestIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (!org || !userId) {
        return;
      }

      const requestId = ++requestIdRef.current;

      if (replace) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      if (!isBrowserOnline()) {
        const cached = await offline.listCachedMusicians(org.id, userId, {
          query: debouncedQuery,
          sortBy: sortField,
          sortDirection,
          groupId: filterGroupId || undefined,
          sectionId: filterSectionId || undefined,
          partId: filterPartId || undefined,
          ensembleRole: filterRole || undefined,
          limit: PAGE_SIZE,
          offset,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setMusicians((prev) => (replace ? cached.items : [...prev, ...cached.items]));
        setTotalCount(cached.totalCount);
        setHasMore(cached.hasMore);
        setOfflineCachedAt(cached.cachedAt);

        if (replace) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
        return;
      }

      setOfflineCachedAt(null);

      const result = await ensemble.listMusicians(org.id, {
        query: debouncedQuery,
        sortBy: sortField,
        sortDirection,
        groupId: filterGroupId || undefined,
        sectionId: filterSectionId || undefined,
        partId: filterPartId || undefined,
        ensembleRole: filterRole || undefined,
        limit: PAGE_SIZE,
        offset,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (result.ok) {
        setMusicians((prev) =>
          replace ? result.value.items : [...prev, ...result.value.items],
        );
        setTotalCount(result.value.totalCount);
        setHasMore(result.value.hasMore);
      }

      if (replace) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    },
    [
      debouncedQuery,
      ensemble,
      filterGroupId,
      filterPartId,
      filterRole,
      filterSectionId,
      offline,
      org,
      sortDirection,
      sortField,
      userId,
    ],
  );

  useEffect(() => {
    if (!org || !userId) {
      return;
    }

    let cancelled = false;

    if (!isBrowserOnline()) {
      void offline.getCachedMusiciansFilterData(org.id, userId).then((filterData) => {
        if (cancelled || !filterData) {
          return;
        }

        setGroups(filterData.groups);
        setParts(filterData.parts);
        setSections(filterData.sections);
      });

      return () => {
        cancelled = true;
      };
    }

    void Promise.all([ensemble.listGroups(org.id), ensemble.listParts(org.id)]).then(
      async ([groupsResult, partsResult]) => {
        if (cancelled) {
          return;
        }

        const loadedGroups = groupsResult.ok ? groupsResult.value : [];
        if (groupsResult.ok) {
          setGroups(loadedGroups);
        }
        if (partsResult.ok) {
          setParts(partsResult.value);
        }

        const sectionResults = await Promise.all(
          loadedGroups.map((group) => ensemble.listSections(org.id, group.id)),
        );
        if (cancelled) {
          return;
        }

        setSections(sectionResults.flatMap((result) => (result.ok ? result.value : [])));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [ensemble, offline, org, userId]);

  useEffect(() => {
    if (!org) {
      return;
    }

    void loadPage(0, true);
  }, [loadPage, org]);

  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) {
      return;
    }

    void loadPage(musicians.length, false);
  }, [hasMore, isLoading, isLoadingMore, loadPage, musicians.length]);

  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }

    const sentinel = sentinelRef.current;
    const scrollRoot = scrollRef.current;
    if (!sentinel || !scrollRoot) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { root: scrollRoot, rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore, musicians.length]);

  function applySortOption(option: SortOption) {
    setSortField(option.field);
    setSortDirection(option.direction);
    setOptionsModalOpen(false);
  }

  function resetCreateForm() {
    setCreateFullName('');
    setCreatePhone('');
    setCreateEmail('');
    setCreateBirthDate('');
    setCreateError(null);
  }

  function openCreateModal() {
    resetCreateForm();
    setCreateModalOpen(true);
  }

  async function handleCreateMusician(event: React.FormEvent) {
    event.preventDefault();
    if (!org) {
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    const result = await ensemble.createMusician(org.id, {
      fullName: createFullName,
      phone: createPhone || null,
      email: createEmail || null,
      birthDate: createBirthDate || null,
    });

    setIsCreating(false);

    if (!result.ok) {
      if (result.error === 'invalid_name') {
        setCreateError('Informe o nome do músico.');
      } else if (result.error === 'invalid_phone') {
        setCreateError('Telefone inválido.');
      } else if (result.error === 'invalid_email') {
        setCreateError('E-mail inválido.');
      } else {
        setCreateError('Não foi possível cadastrar o músico.');
      }
      return;
    }

    setCreateModalOpen(false);
    navigate(`/${orgSlug}/musicos/${result.value.id}`);
  }

  if (!org) {
    return null;
  }

  if (!isAdmin) {
    return <div className="text-muted">Acesso restrito a administradores.</div>;
  }

  const isSearching = normalizeSearchText(debouncedQuery).length > 0;
  const extraFiltersActive = Boolean(
    filterGroupId || filterSectionId || filterPartId || filterRole,
  );
  const isFiltering = isSearching || extraFiltersActive;
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  const visibleSections = filterGroupId
    ? sections.filter((section) => section.groupId === filterGroupId)
    : sections;
  const showEmptyState = !isLoading && musicians.length === 0;
  const emptyMessage = isFiltering
    ? 'Nenhum músico encontrado.'
    : 'Nenhum músico na organização.';

  return (
    <>
    <OrgListPageLayout
      scrollRef={scrollRef}
      header={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text">Músicos</h1>
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
          {isAdmin && online && (
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              + Músico
            </button>
          )}
        </div>
      }
      toolbar={
        !isLoading && (totalCount > 0 || isFiltering) ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                <span className="sr-only">Buscar músicos</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nome ou telefone…"
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className={`relative inline-flex shrink-0 items-center justify-center rounded-lg border px-3 py-2 transition-colors ${
                  filtersOpen
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-bg text-muted hover:bg-surface hover:text-text'
                }`}
                aria-label={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                aria-expanded={filtersOpen}
                aria-controls={filtersPanelId}
              >
                <IconFilter className="h-5 w-5" />
                {extraFiltersActive && !filtersOpen && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOptionsModalOpen(true)}
                aria-label="Ordenar"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-bg px-3 py-2 text-muted transition-colors hover:bg-surface hover:text-text"
              >
                <IconArrowUpDown className="h-5 w-5" />
              </button>
            </div>
            {filtersOpen && (
              <div id={filtersPanelId} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <label className="min-w-0">
                  <span className="sr-only">Grupo</span>
                  <select
                    aria-label="Grupo"
                    value={filterGroupId}
                    onChange={(event) => {
                      const nextGroupId = event.target.value;
                      setFilterGroupId(nextGroupId);
                      const selectedSection = sections.find((section) => section.id === filterSectionId);
                      if (
                        nextGroupId &&
                        selectedSection &&
                        selectedSection.groupId !== nextGroupId
                      ) {
                        setFilterSectionId('');
                      }
                    }}
                    className={filterSelectClass}
                  >
                    <option value="">Todos os grupos</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="sr-only">Naipe</span>
                  <select
                    aria-label="Naipe"
                    value={filterSectionId}
                    onChange={(event) => setFilterSectionId(event.target.value)}
                    className={filterSelectClass}
                  >
                    <option value="">Todos os naipes</option>
                    {visibleSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {filterGroupId
                          ? section.name
                          : `${groupNameById.get(section.groupId) ?? ''} — ${section.name}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="sr-only">Parte</span>
                  <select
                    aria-label="Parte"
                    value={filterPartId}
                    onChange={(event) => setFilterPartId(event.target.value)}
                    className={filterSelectClass}
                  >
                    <option value="">Todas as partes</option>
                    {parts.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="sr-only">Papel</span>
                  <select
                    aria-label="Papel"
                    value={filterRole}
                    onChange={(event) =>
                      setFilterRole(event.target.value as EnsembleRole | '')
                    }
                    className={filterSelectClass}
                  >
                    <option value="">Todos os papéis</option>
                    {ENSEMBLE_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : showEmptyState ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {musicians.map((musician) => {
              const whatsappUrl = musicianWhatsAppUrl(musician.phone);

              return (
                <li key={musician.id}>
                  <div className="flex items-center rounded-xl border border-border bg-surface transition-colors hover:bg-bg">
                    <Link
                      to={`/${orgSlug}/musicos/${musician.id}`}
                      className="min-w-0 flex-1 px-4 py-3"
                    >
                      <p className="font-medium text-text">{musician.fullName}</p>
                      {musician.groupNames.length > 0 && (
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {musician.groupNames.join(', ')}
                        </p>
                      )}
                    </Link>
                    {!musician.userId && (
                      <MusicianClaimLinkCopyButton
                        musicianId={musician.id}
                        musicianName={musician.fullName}
                        className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted transition-colors hover:bg-bg hover:text-text ${
                          whatsappUrl ? 'mr-2' : 'mr-3'
                        }`}
                      />
                    )}
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir WhatsApp de ${musician.fullName}`}
                        className="mr-3 inline-flex shrink-0 items-center justify-center rounded-lg bg-[#25D366] p-2 text-white transition-opacity hover:opacity-90"
                      >
                        <IconWhatsApp className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div ref={sentinelRef} className="h-1" aria-hidden />

          {isLoadingMore && (
            <p className="mt-4 text-center text-sm text-muted">Carregando mais…</p>
          )}
        </>
      )}
    </OrgListPageLayout>

    <Modal
        open={optionsModalOpen}
        onClose={() => setOptionsModalOpen(false)}
        title="Ordenar"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-text">Ordenar por</legend>
          {SORT_OPTIONS.map((option) => {
            const selected = isSameSort(
              { field: sortField, direction: sortDirection },
              option,
            );

            return (
              <label
                key={option.label}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5 text-text'
                    : 'border-border bg-bg text-text hover:bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="musician-sort"
                  checked={selected}
                  onChange={() => applySortOption(option)}
                  className="accent-primary"
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
      </Modal>

      <Modal
        open={createModalOpen}
        onClose={() => {
          if (!isCreating) {
            setCreateModalOpen(false);
          }
        }}
        title="Adicionar músico"
      >
        <form className="flex flex-col gap-4" onSubmit={handleCreateMusician}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Nome completo</span>
            <input
              type="text"
              value={createFullName}
              onChange={(e) => setCreateFullName(e.target.value)}
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Telefone (opcional)</span>
            <input
              type="tel"
              value={createPhone}
              onChange={(e) => setCreatePhone(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">E-mail (opcional)</span>
            <input
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Data de nascimento (opcional)</span>
            <input
              type="date"
              value={createBirthDate}
              onChange={(e) => setCreateBirthDate(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isCreating ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </form>
      </Modal>
    </>
  );
}

