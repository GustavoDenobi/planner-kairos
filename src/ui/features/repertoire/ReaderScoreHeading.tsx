import { IconChevronLeft, IconChevronRight } from '@/ui/components/icons';

export type ReaderScorePlaylistNav = {
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

type ReaderScoreHeadingProps = {
  pieceTitle: string;
  partLabel?: string | null;
  fileTitle: string;
  segment?: string | null;
  observation?: string | null;
  onTitleClick?: () => void;
  playlistNav?: ReaderScorePlaylistNav | null;
};

function joinDistinct(parts: Array<string | null | undefined>): string {
  const values: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value || values[values.length - 1] === value) {
      continue;
    }
    values.push(value);
  }
  return values.join(' · ');
}

const navButtonClass =
  'shrink-0 rounded-lg border border-border p-1.5 text-text disabled:opacity-40';

export function ReaderScoreHeading({
  pieceTitle,
  partLabel,
  fileTitle,
  segment,
  observation,
  onTitleClick,
  playlistNav,
}: ReaderScoreHeadingProps) {
  const primaryLine = joinDistinct([pieceTitle, partLabel, fileTitle]);
  const secondaryLine = joinDistinct([segment, observation]);
  const titleClass = playlistNav
    ? 'block max-w-full truncate text-sm font-medium text-text'
    : 'block max-w-full truncate text-base font-medium text-text sm:text-lg';

  return (
    <div className="flex w-full min-w-0 justify-center">
      <div className="flex w-max max-w-full min-w-0 items-center gap-1.5 sm:gap-2">
        {playlistNav ? (
          <button
            type="button"
            onClick={playlistNav.onPrevious}
            disabled={!playlistNav.canGoPrevious}
            aria-label="Obra anterior"
            className={navButtonClass}
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0 text-center">
          {onTitleClick ? (
            <button
              type="button"
              onClick={onTitleClick}
              className={`${titleClass} underline-offset-2 hover:underline`}
            >
              {primaryLine}
            </button>
          ) : (
            <p className={titleClass}>{primaryLine}</p>
          )}
          {secondaryLine ? (
            <p className="block max-w-full truncate text-xs text-muted">{secondaryLine}</p>
          ) : null}
        </div>
        {playlistNav ? (
          <button
            type="button"
            onClick={playlistNav.onNext}
            disabled={!playlistNav.canGoNext}
            aria-label="Próxima obra"
            className={navButtonClass}
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
