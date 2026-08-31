import type { PieceFileTocEntry } from '@/domain/repertoire';

type TocEntryOverlayProps = {
  entries: PieceFileTocEntry[];
  pageNumber: number;
  onEntryPress?: (entry: PieceFileTocEntry) => void;
  inverted?: boolean;
  disabled?: boolean;
};

export function TocEntryOverlay({
  entries,
  pageNumber,
  onEntryPress,
  inverted = false,
  disabled = false,
}: TocEntryOverlayProps) {
  const pageEntries = entries.filter((entry) => entry.targetPageNumber === pageNumber);

  if (pageEntries.length === 0) {
    return null;
  }

  const labelBgClass = inverted ? 'bg-black/95 text-white' : 'bg-white/95 text-text';

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {pageEntries.map((entry) => {
        const x = entry.targetX ?? 0.5;
        const y = entry.targetY ?? 0.5;
        const hasPosition = entry.targetY != null;

        if (!hasPosition) {
          return null;
        }

        const marker = (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
            }}
            title={entry.label}
          >
            <div className="h-3 w-3 rounded-full border-2 border-primary bg-primary/30 shadow-sm" />
          </div>
        );

        if (!onEntryPress || disabled) {
          return (
            <div key={entry.id} aria-hidden>
              {marker}
            </div>
          );
        }

        return (
          <button
            key={entry.id}
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onEntryPress(entry);
            }}
            className={`pointer-events-auto absolute max-w-[min(44%,11rem)] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border border-primary ${labelBgClass} px-2.5 py-1 text-xs font-semibold shadow-sm disabled:opacity-50`}
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
            }}
            title={entry.label}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}
