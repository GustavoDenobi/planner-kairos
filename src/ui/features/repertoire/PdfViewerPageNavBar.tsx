import { useCallback, useEffect, useRef, useState } from 'react';
import type * as pdfjs from 'pdfjs-dist';
import { IconChevronLeft, IconChevronRight, IconHome, IconList } from '@/ui/components/icons';
import { PdfPageThumbnail } from '@/ui/features/repertoire/PdfPageThumbnail';

const AUTO_HIDE_MS = 3000;
const THUMBNAIL_MAX_WIDTH_PX = 160;
const THUMBNAIL_DEBOUNCE_MS = 75;

type PdfViewerPageNavBarProps = {
  pdf: pdfjs.PDFDocumentProxy;
  inverted: boolean;
  currentPage: number;
  numPages: number;
  onGoHome: () => void;
  onOpenToc?: () => void;
  onPageChange: (page: number) => void;
  onRequestClose: () => void;
  showTocButton?: boolean;
  visible: boolean;
  persistent?: boolean;
};

export function PdfViewerPageNavBar({
  pdf,
  inverted,
  currentPage,
  numPages,
  onGoHome,
  onOpenToc,
  onPageChange,
  onRequestClose,
  showTocButton = false,
  visible,
  persistent = false,
}: PdfViewerPageNavBarProps) {
  const hideTimeoutRef = useRef<number | null>(null);
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  const [isScrubbing, setIsScrubbing] = useState(false);
  const isScrubbingRef = useRef(false);
  const [scrubPage, setScrubPage] = useState(currentPage);
  const scrubPageRef = useRef(scrubPage);
  scrubPageRef.current = scrubPage;
  const [thumbnailPage, setThumbnailPage] = useState(currentPage);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      hideTimeoutRef.current = null;
      onRequestCloseRef.current();
    }, AUTO_HIDE_MS);
  }, [clearHideTimeout]);

  useEffect(() => {
    if (!visible) {
      clearHideTimeout();
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      setScrubPage(currentPage);
      setThumbnailPage(currentPage);
      return;
    }

    if (!isScrubbing && !persistent) {
      scheduleHide();
    }

    return clearHideTimeout;
  }, [visible, isScrubbing, persistent, currentPage, scheduleHide, clearHideTimeout]);

  useEffect(() => {
    if (!isScrubbing) {
      setScrubPage(currentPage);
      setThumbnailPage(currentPage);
    }
  }, [currentPage, isScrubbing]);

  useEffect(() => {
    if (!isScrubbing) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setThumbnailPage(scrubPage);
    }, THUMBNAIL_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [scrubPage, isScrubbing]);

  const commitScrub = useCallback(() => {
    if (!isScrubbingRef.current) {
      return;
    }

    isScrubbingRef.current = false;
    setIsScrubbing(false);
    onPageChangeRef.current(scrubPageRef.current);
    if (!persistent) {
      scheduleHide();
    }
  }, [persistent, scheduleHide]);

  const handleSliderPointerDown = useCallback(() => {
    clearHideTimeout();
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    setScrubPage(currentPage);
    scrubPageRef.current = currentPage;
    setThumbnailPage(currentPage);
  }, [clearHideTimeout, currentPage]);

  const handleSliderInput = useCallback((value: number) => {
    scrubPageRef.current = value;
    setScrubPage(value);
  }, []);

  const displayedPage = isScrubbing ? scrubPage : currentPage;

  const keepOpenOnAction = useCallback(() => {
    if (!persistent) {
      scheduleHide();
    }
  }, [persistent, scheduleHide]);

  if (!visible) {
    return null;
  }

  const shellClass = persistent
    ? 'pdf-page-nav-bar pointer-events-auto relative z-40 flex w-full shrink-0 flex-col border-t border-border bg-surface/95 pb-[var(--safe-area-bottom)] backdrop-blur-sm'
    : 'pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center px-4 pb-[max(0.75rem,var(--safe-area-bottom))]';
  const thumbnailClass = persistent
    ? 'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface/95 shadow-lg backdrop-blur-sm'
    : 'pdf-page-nav-bar pointer-events-none mb-2 overflow-hidden rounded-lg border border-border bg-surface/95 shadow-lg backdrop-blur-sm';
  const rowClass = persistent
    ? 'flex w-full items-center gap-2 px-3 py-2 sm:gap-3'
    : 'pdf-page-nav-bar pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-border bg-surface/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:gap-3';

  return (
    <div
      className={shellClass}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {isScrubbing && (
        <div className={thumbnailClass} aria-hidden>
          <PdfPageThumbnail
            pdf={pdf}
            pageNumber={thumbnailPage}
            maxWidth={THUMBNAIL_MAX_WIDTH_PX}
            inverted={inverted}
          />
        </div>
      )}

      <div className={rowClass}>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              keepOpenOnAction();
              onGoHome();
            }}
            disabled={currentPage <= 1}
            aria-label="Ir para a primeira página"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text disabled:opacity-40"
          >
            <IconHome className="h-4 w-4" />
          </button>

          {showTocButton && onOpenToc && (
            <button
              type="button"
              onClick={() => {
                keepOpenOnAction();
                onOpenToc();
              }}
              aria-label="Sumário"
              title="Sumário"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text"
            >
              <IconList className="h-4 w-4" />
            </button>
          )}
        </div>

        <input
          type="range"
          min={1}
          max={numPages}
          value={displayedPage}
          onPointerDown={handleSliderPointerDown}
          onInput={(event) => {
            handleSliderInput(Number.parseInt(event.currentTarget.value, 10));
          }}
          onPointerUp={commitScrub}
          onLostPointerCapture={commitScrub}
          aria-label="Navegar entre páginas"
          aria-valuetext={`Página ${displayedPage} de ${numPages}`}
          className="min-w-0 flex-1 accent-primary"
        />

        <span
          className="shrink-0 tabular-nums text-sm font-medium text-text"
          aria-live="polite"
          aria-label={`Página ${displayedPage} de ${numPages}`}
        >
          {displayedPage}/{numPages}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              keepOpenOnAction();
              onPageChange(currentPage - 1);
            }}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text disabled:opacity-40"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              keepOpenOnAction();
              onPageChange(currentPage + 1);
            }}
            disabled={currentPage >= numPages}
            aria-label="Próxima página"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text disabled:opacity-40"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
