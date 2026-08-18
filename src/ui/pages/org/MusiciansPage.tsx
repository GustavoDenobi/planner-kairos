import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  MusicianSortDirection,
  MusicianSortField,
} from '@/application/ports/musician-repository';
import type { MusicianListItem } from '@/domain/ensemble';
import { useEnsemble } from '@/ui/app/AppServicesContext';
import { useOrg } from '@/ui/app/OrgProvider';
import { Modal } from '@/ui/components/Modal';
import { IconArrowUpDown } from '@/ui/components/icons';
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
  { field: 'name', direction: 'asc', label: 'Nome (A–Z)' },
  { field: 'name', direction: 'desc', label: 'Nome (Z–A)' },
  { field: 'created_at', direction: 'desc', label: 'Cadastro (mais recente)' },
  { field: 'created_at', direction: 'asc', label: 'Cadastro (mais antigo)' },
];

function isSameSort(
  a: { field: MusicianSortField; direction: MusicianSortDirection },
  b: { field: MusicianSortField; direction: MusicianSortDirection },
) {
  return a.field === b.field && a.direction === b.direction;
}

export function MusiciansPage() {
  const { orgSlug } = useParams();
  const ensemble = useEnsemble();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);
  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  const [musicians, setMusicians] = useState<MusicianListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortField, setSortField] = useState<MusicianSortField>('name');
  const [sortDirection, setSortDirection] = useState<MusicianSortDirection>('asc');
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);

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
      if (!org) {
        return;
      }

      const requestId = ++requestIdRef.current;

      if (replace) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const result = await ensemble.listMusicians(org.id, {
        query: debouncedQuery,
        sortBy: sortField,
        sortDirection,
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
    [debouncedQuery, ensemble, org, sortDirection, sortField],
  );

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

  if (!org) {
    return null;
  }

  if (!isAdmin) {
    return <div className="text-muted">Acesso restrito a administradores.</div>;
  }

  const isSearching = normalizeSearchText(debouncedQuery).length > 0;
  const showEmptyState = !isLoading && musicians.length === 0;
  const emptyMessage = isSearching
    ? 'Nenhum músico encontrado.'
    : 'Nenhum músico na organização.';

  return (
    <>
    <OrgListPageLayout
      scrollRef={scrollRef}
      header={
        <h1 className="text-2xl font-semibold text-text">Músicos</h1>
      }
      toolbar={
        !isLoading && (totalCount > 0 || isSearching) ? (
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
              onClick={() => setOptionsModalOpen(true)}
              aria-label="Ordenar e opções"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-bg px-3 py-2 text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <IconArrowUpDown className="h-5 w-5" />
            </button>
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
            {musicians.map((musician) => (
              <li key={musician.id}>
                <Link
                  to={`/${orgSlug}/musicos/${musician.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-text">{musician.fullName}</p>
                    {musician.groupNames.length > 0 && (
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {musician.groupNames.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="ml-3 shrink-0 text-sm text-muted">
                    {musician.assignmentCount} atrib.
                  </span>
                </Link>
              </li>
            ))}
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
        title="Ordenar e opções"
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
    </>
  );
}

