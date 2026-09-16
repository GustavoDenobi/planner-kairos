import { useEffect, useMemo, useState, type RefObject } from 'react';

const PAGE_BUFFER = 1;
const ROOT_MARGIN = '150% 0px';

export function usePdfVisiblePages(
  scrollRef: RefObject<HTMLElement | null>,
  numPages: number,
  currentPage: number,
  enabled: boolean,
): Set<number> {
  const [observedPages, setObservedPages] = useState<Set<number>>(() => new Set([1]));

  useEffect(() => {
    if (!enabled || numPages === 0) {
      setObservedPages(new Set([Math.min(Math.max(currentPage, 1), numPages || 1)]));
      return;
    }

    const root = scrollRef.current;
    if (!root) {
      return;
    }

    let observer: IntersectionObserver | null = null;
    const frameId = requestAnimationFrame(() => {
      if (!scrollRef.current) {
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          setObservedPages((previous) => {
            const next = new Set(previous);
            let changed = false;

            for (const entry of entries) {
              const pageNumber = Number.parseInt(
                (entry.target as HTMLElement).dataset.pageNumber ?? '0',
                10,
              );
              if (pageNumber <= 0) {
                continue;
              }

              if (entry.isIntersecting) {
                if (!next.has(pageNumber)) {
                  next.add(pageNumber);
                  changed = true;
                }
              }
            }

            return changed ? next : previous;
          });
        },
        { root: scrollRef.current, rootMargin: ROOT_MARGIN, threshold: 0 },
      );

      const pageElements = scrollRef.current.querySelectorAll('[data-page-number]');
      for (const pageElement of pageElements) {
        observer.observe(pageElement);
      }
    });

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [enabled, numPages, scrollRef]);

  return useMemo(() => {
    const pages = new Set(observedPages);
    const anchor = Math.min(Math.max(currentPage, 1), Math.max(numPages, 1));

    pages.add(anchor);
    for (
      let pageNumber = anchor - PAGE_BUFFER;
      pageNumber <= anchor + PAGE_BUFFER;
      pageNumber += 1
    ) {
      if (pageNumber >= 1 && pageNumber <= numPages) {
        pages.add(pageNumber);
      }
    }

    return pages;
  }, [observedPages, currentPage, numPages]);
}
