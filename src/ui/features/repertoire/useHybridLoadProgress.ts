import { useCallback, useEffect, useRef, useState } from 'react';
import {
  combineHybridLoadBarFraction,
  type PdfDownloadProgressHandler,
} from '@/ui/features/repertoire/hybrid-load-progress';

export function useHybridLoadProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const downloadRef = useRef({ loaded: 0, total: 0 });
  const frameRef = useRef<number | null>(null);

  const reportDownloadProgress = useCallback<PdfDownloadProgressHandler>((loaded, total) => {
    downloadRef.current = { loaded, total };
  }, []);

  const completeProgress = useCallback(() => {
    setProgress(1);
  }, []);

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null;
      downloadRef.current = { loaded: 0, total: 0 };
      setProgress(0);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    startedAtRef.current = performance.now();

    const tick = () => {
      const startedAt = startedAtRef.current;
      if (startedAt === null) {
        return;
      }

      const elapsed = performance.now() - startedAt;
      const { loaded, total } = downloadRef.current;
      setProgress(combineHybridLoadBarFraction(elapsed, loaded, total));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [active]);

  return { progress, reportDownloadProgress, completeProgress };
}
