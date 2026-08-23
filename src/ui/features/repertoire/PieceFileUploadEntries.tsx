import { useEffect, useState } from 'react';
import { isPieceFileScore } from '@/domain/repertoire';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { IconChevronLeft, IconChevronRight, IconAlertTriangle } from '@/ui/components/icons';

export type PartLinkSelection = {
  partId: string;
  partDivisionId: string | null;
};

export type UploadFileEntry = {
  id: string;
  file: File;
  title: string;
  partLinks: PartLinkSelection[];
  contentHash: string;
  duplicateOfTitle?: string | null;
};

type PieceFileUploadEntriesProps = {
  entries: UploadFileEntry[];
  parts: PartWithDivisions[];
  disabled?: boolean;
  onEntryChange: (id: string, patch: Partial<Pick<UploadFileEntry, 'title' | 'partLinks'>>) => void;
  onRemoveEntry: (id: string) => void;
};

function partLinkKey(link: PartLinkSelection): string {
  return `${link.partId}:${link.partDivisionId ?? 'all'}`;
}

function isPartLinkSelected(
  links: PartLinkSelection[],
  partId: string,
  partDivisionId: string | null,
): boolean {
  return links.some(
    (link) => link.partId === partId && link.partDivisionId === partDivisionId,
  );
}

function togglePartLink(
  links: PartLinkSelection[],
  partId: string,
  partDivisionId: string | null,
): PartLinkSelection[] {
  const key = partLinkKey({ partId, partDivisionId });
  const exists = links.some((link) => partLinkKey(link) === key);
  if (exists) {
    return links.filter((link) => partLinkKey(link) !== key);
  }
  return [...links, { partId, partDivisionId }];
}

function UploadEntryCard({
  entry,
  parts,
  disabled,
  onEntryChange,
  onRemoveEntry,
  canRemove,
}: {
  entry: UploadFileEntry;
  parts: PartWithDivisions[];
  disabled?: boolean;
  onEntryChange: (id: string, patch: Partial<Pick<UploadFileEntry, 'title' | 'partLinks'>>) => void;
  onRemoveEntry: (id: string) => void;
  canRemove: boolean;
}) {
  const isPdf = isPieceFileScore(entry.file);
  const supportsPartLinks =
    isPdf || entry.file.type.startsWith('audio/') || /\.(mp3|wav)$/i.test(entry.file.name);

  return (
    <div className="">
      <hr className="border-border my-4" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text truncate" title={entry.file.name}>
            {entry.file.name}
          </p>
        </div>
        {canRemove && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemoveEntry(entry.id)}
            className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-60"
          >
            Remover
          </button>
        )}
      </div>
      {entry.duplicateOfTitle && (
        <div
          role="status"
          className="mt-2 rounded-lg border border-border bg-bg px-3 py-2"
        >
          <p className="text-sm text-muted text-center">
            <IconAlertTriangle className="h-4 w-4 inline-block mr-1" /> Este arquivo já existe nesta peça com o título <br/>
          </p>
          <p className="text-sm text-muted text-center font-bold">{entry.duplicateOfTitle}</p>
        </div>
      )}
      <label className="block space-y-2 mt-4">
        <span className="text-sm font-medium text-text">Título</span>
        <input
          type="text"
          value={entry.title}
          onChange={(event) => onEntryChange(entry.id, { title: event.target.value })}
          disabled={disabled}
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      </label>

      {supportsPartLinks && (
        <fieldset className="space-y-2 mt-4">
          <legend className="text-sm font-medium text-text">Partes</legend>
          <div className="min-h-48 max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
            {parts.map((part) => (
              <div key={part.id} className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={isPartLinkSelected(entry.partLinks, part.id, null)}
                    onChange={() =>
                      onEntryChange(entry.id, {
                        partLinks: togglePartLink(entry.partLinks, part.id, null),
                      })
                    }
                  />
                  {part.name}
                </label>
                {part.divisions.map((division) => (
                  <label
                    key={division.id}
                    className="ml-6 flex items-center gap-2 text-sm text-muted"
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={isPartLinkSelected(entry.partLinks, part.id, division.id)}
                      onChange={() =>
                        onEntryChange(entry.id, {
                          partLinks: togglePartLink(entry.partLinks, part.id, division.id),
                        })
                      }
                    />
                    {division.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function PieceFileUploadEntries({
  entries,
  parts,
  disabled,
  onEntryChange,
  onRemoveEntry,
}: PieceFileUploadEntriesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (currentIndex >= entries.length) {
      setCurrentIndex(Math.max(0, entries.length - 1));
    }
  }, [entries.length, currentIndex]);

  if (entries.length === 0) {
    return null;
  }

  const entry = entries[currentIndex];
  const hasMultiple = entries.length > 1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < entries.length - 1;

  function goPrev() {
    if (!canGoPrev) {
      return;
    }
    setShouldAnimate(true);
    setSlideDirection('prev');
    setCurrentIndex((index) => Math.max(0, index - 1));
  }

  function goNext() {
    if (!canGoNext) {
      return;
    }
    setShouldAnimate(true);
    setSlideDirection('next');
    setCurrentIndex((index) => Math.min(entries.length - 1, index + 1));
  }

  const slideClass = shouldAnimate
    ? slideDirection === 'next'
      ? 'upload-entry-slide-in-next'
      : 'upload-entry-slide-in-prev'
    : '';

  return (
    <div className="space-y-3">
      <div className="overflow-hidden">
        <div key={entry.id} className={slideClass}>
          <UploadEntryCard
            entry={entry}
            parts={parts}
            disabled={disabled}
            onEntryChange={onEntryChange}
            onRemoveEntry={onRemoveEntry}
            canRemove={hasMultiple}
          />
        </div>
      </div>

      {hasMultiple && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={disabled || !canGoPrev}
            onClick={goPrev}
            aria-label="Arquivo anterior"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>

          <span className="text-sm tabular-nums text-muted">
            {currentIndex + 1} / {entries.length}
          </span>

          <button
            type="button"
            disabled={disabled || !canGoNext}
            onClick={goNext}
            aria-label="Próximo arquivo"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
