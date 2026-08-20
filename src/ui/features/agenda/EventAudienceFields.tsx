import { useMemo, useState } from 'react';
import type { GroupKind } from '@/domain/ensemble';
import { IconUser, IconX } from '@/ui/components/icons';
import { GroupKindIcon } from '@/ui/features/ensemble/group-icons';
import { matchesSearchText } from '@/ui/utils/normalize-search-text';

type GroupOption = {
  id: string;
  name: string;
  kind: GroupKind;
};

type MusicianOption = {
  id: string;
  name: string;
  partNames?: string[];
};

type EventAudienceFieldsProps = {
  groups: GroupOption[];
  musicians: MusicianOption[];
  selectedGroupIds: string[];
  selectedMusicianIds: string[];
  onGroupIdsChange: (ids: string[]) => void;
  onMusicianIdsChange: (ids: string[]) => void;
  lockedGroupIds?: string[];
  lockedMusicianIds?: string[];
  disabled?: boolean;
};

type Candidate =
  | (GroupOption & { audienceKind: 'group' })
  | (MusicianOption & { audienceKind: 'musician' });

const fieldClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text disabled:opacity-60';

function byName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name, 'pt-BR');
}

function AudienceIcon({ item }: { item: Candidate }) {
  if (item.audienceKind === 'musician') {
    return <IconUser className="h-4 w-4 shrink-0 text-muted" />;
  }
  return <GroupKindIcon kind={item.kind} className="h-4 w-4 shrink-0 text-muted" />;
}

function MusicianName({ name, partNames }: { name: string; partNames?: string[] }) {
  const partsLabel = partNames && partNames.length > 0 ? partNames.join(', ') : null;

  if (!partsLabel) {
    return <span className="min-w-0 flex-1 truncate text-sm text-text">{name}</span>;
  }

  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-2 text-sm">
      <span className="max-w-[55%] shrink-0 truncate text-text">{name}</span>
      <span className="min-w-0 truncate text-muted" title={partsLabel}>
        {partsLabel}
      </span>
    </span>
  );
}

export function EventAudienceFields({
  groups,
  musicians,
  selectedGroupIds,
  selectedMusicianIds,
  onGroupIdsChange,
  onMusicianIdsChange,
  lockedGroupIds = [],
  lockedMusicianIds = [],
  disabled = false,
}: EventAudienceFieldsProps) {
  const [query, setQuery] = useState('');
  const lockedGroups = useMemo(() => new Set(lockedGroupIds), [lockedGroupIds]);
  const lockedMusicians = useMemo(() => new Set(lockedMusicianIds), [lockedMusicianIds]);
  const selectedGroups = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const selectedMusicians = useMemo(() => new Set(selectedMusicianIds), [selectedMusicianIds]);

  const groupById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  const musicianById = useMemo(
    () => new Map(musicians.map((musician) => [musician.id, musician])),
    [musicians],
  );

  const selectedItems: Candidate[] = [
    ...selectedGroupIds.flatMap((id) => {
      const group = groupById.get(id);
      return group ? [{ ...group, audienceKind: 'group' as const }] : [];
    }),
    ...selectedMusicianIds.flatMap((id) => {
      const musician = musicianById.get(id);
      return musician ? [{ ...musician, audienceKind: 'musician' as const }] : [];
    }),
  ];

  const candidates = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return [] as Candidate[];
    }

    const matchingGroups: Candidate[] = groups
      .filter((group) => !selectedGroups.has(group.id) && matchesSearchText(group.name, trimmed))
      .sort(byName)
      .map((group) => ({ ...group, audienceKind: 'group' as const }));

    const matchingMusicians: Candidate[] = musicians
      .filter(
        (musician) =>
          !selectedMusicians.has(musician.id) &&
          (matchesSearchText(musician.name, trimmed) ||
            (musician.partNames ?? []).some((partName) =>
              matchesSearchText(partName, trimmed),
            )),
      )
      .sort(byName)
      .map((musician) => ({ ...musician, audienceKind: 'musician' as const }));

    return [...matchingGroups, ...matchingMusicians].slice(0, 20);
  }, [groups, musicians, query, selectedGroups, selectedMusicians]);

  function addCandidate(candidate: Candidate) {
    if (candidate.audienceKind === 'group') {
      if (!selectedGroups.has(candidate.id)) {
        onGroupIdsChange([...selectedGroupIds, candidate.id]);
      }
    } else if (!selectedMusicians.has(candidate.id)) {
      onMusicianIdsChange([...selectedMusicianIds, candidate.id]);
    }
    setQuery('');
  }

  function removeCandidate(candidate: Candidate) {
    if (candidate.audienceKind === 'group') {
      if (lockedGroups.has(candidate.id)) {
        return;
      }
      onGroupIdsChange(selectedGroupIds.filter((id) => id !== candidate.id));
      return;
    }
    if (lockedMusicians.has(candidate.id)) {
      return;
    }
    onMusicianIdsChange(selectedMusicianIds.filter((id) => id !== candidate.id));
  }

  const showCandidates = query.trim().length > 0 && !disabled;

  return (
    <div className="space-y-4 mt-4">
      <p className="text-lg font-semibold text-text">
        Participantes
      </p>

      <div className="space-y-1">
        <label className="block">
          <span className="sr-only">Buscar grupos ou músicos</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar grupos ou músicos"
            disabled={disabled}
            className={fieldClass}
            autoComplete="off"
          />
        </label>
        {showCandidates && (
          <ul
            className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1"
            role="listbox"
          >
            {candidates.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">Nenhum resultado.</li>
            ) : (
              candidates.map((candidate) => (
                <li key={`${candidate.audienceKind}-${candidate.id}`}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => addCandidate(candidate)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg"
                  >
                    <AudienceIcon item={candidate} />
                    {candidate.audienceKind === 'musician' ? (
                      <MusicianName name={candidate.name} partNames={candidate.partNames} />
                    ) : (
                      <span className="truncate text-text">{candidate.name}</span>
                    )}
                    <span className="sr-only">
                      {candidate.audienceKind === 'group' ? 'Grupo' : 'Músico'}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-text">Incluídos</p>
        {selectedItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted">
            Nenhum grupo ou músico associado.
          </p>
        ) : (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {selectedItems.map((item) => {
              const locked =
                item.audienceKind === 'group'
                  ? lockedGroups.has(item.id)
                  : lockedMusicians.has(item.id);

              return (
                <li
                  key={`${item.audienceKind}-${item.id}`}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <AudienceIcon item={item} />
                  {item.audienceKind === 'musician' ? (
                    <MusicianName name={item.name} partNames={item.partNames} />
                  ) : (
                    <p className="min-w-0 flex-1 truncate text-sm text-text">{item.name}</p>
                  )}
                  <span className="sr-only">
                    {item.audienceKind === 'group' ? 'Grupo' : 'Músico'}
                  </span>
                  {locked ? (
                    <span className="shrink-0 text-xs text-muted">Fixo</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeCandidate(item)}
                      disabled={disabled}
                      className="inline-flex shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-bg hover:text-text disabled:opacity-60"
                      aria-label={`Remover ${item.name}`}
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
