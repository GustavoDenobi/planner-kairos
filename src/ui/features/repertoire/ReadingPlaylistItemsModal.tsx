import { useEffect } from 'react';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { playlistItemObservation, type ReadingPlaylistItemDetail } from '@/domain/repertoire';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { Modal } from '@/ui/components/Modal';
import { formatPartLinks } from '@/ui/features/repertoire/repertoire-labels';
import { isPlaylistItemAvailable } from '@/ui/features/repertoire/playlist-reader-item-cache';

type ReadingPlaylistItemsModalProps = {
  open: boolean;
  onClose: () => void;
  playlistName: string;
  items: ReadingPlaylistItemDetail[];
  currentIndex: number;
  parts: PartWithDivisions[];
  onSelect: (index: number) => void;
};

export function ReadingPlaylistItemsModal({
  open,
  onClose,
  playlistName,
  items,
  currentIndex,
  parts,
  onSelect,
}: ReadingPlaylistItemsModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    document.getElementById(`playlist-item-${currentIndex}`)?.scrollIntoView({
      block: 'nearest',
    });
  }, [open, currentIndex]);

  return (
    <Modal open={open} onClose={onClose} title={playlistName} size="lg">
      {items.length === 0 ? (
        <p className="text-center text-sm text-muted">Nenhuma partitura na playlist.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => {
            const available = isPlaylistItemAvailable(item);
            const partLabel =
              parts.length > 0 ? formatPartLinks(item.partLinks, parts) : null;
            const selectionDetail = [
              item.label?.trim(),
              playlistItemObservation(item),
            ]
              .filter((value): value is string => Boolean(value))
              .join(' · ');
            const current = index === currentIndex;

            return (
              <li key={item.id}>
                <button
                  id={`playlist-item-${index}`}
                  type="button"
                  disabled={!available}
                  onClick={() => onSelect(index)}
                  className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left disabled:cursor-default disabled:opacity-50 ${
                    current ? 'border-primary bg-primary/5' : 'border-border bg-surface'
                  }`}
                  aria-current={current ? 'true' : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text">{item.fileTitle}</p>
                        <p className="text-sm text-muted">{item.pieceTitle}</p>
                        {partLabel ? (
                          <p className="mt-0.5 text-sm text-muted">{partLabel}</p>
                        ) : null}
                        {selectionDetail ? (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-text">{selectionDetail}</p>
                        ) : null}
                        {!available ? (
                          <p className="mt-0.5 text-xs text-muted">Obra removida do catálogo</p>
                        ) : null}
                      </div>
                      {item.pieceCategory ? (
                        <CategoryBadge
                          label={item.pieceCategory.name}
                          color={item.pieceCategory.color}
                          slug={item.pieceCategory.slug}
                          className="shrink-0"
                        />
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
