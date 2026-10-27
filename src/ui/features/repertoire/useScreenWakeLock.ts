import { useEffect, useRef } from 'react';

function isScreenWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

/**
 * Mantém a tela ligada enquanto `enabled` (Screen Wake Lock API).
 * Reativa ao voltar à aba quando o navegador libera o lock.
 */
export function useScreenWakeLock(enabled: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !isScreenWakeLockSupported()) {
      return;
    }

    let cancelled = false;

    const release = async () => {
      const sentinel = sentinelRef.current;
      if (!sentinel) {
        return;
      }
      sentinelRef.current = null;
      try {
        await sentinel.release();
      } catch {
        // já liberado
      }
    };

    const request = async () => {
      if (cancelled || document.visibilityState !== 'visible') {
        return;
      }
      try {
        await release();
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // NotAllowedError ou API indisponível neste contexto
      }
    };

    void request();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void request();
      } else {
        void release();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void release();
    };
  }, [enabled]);
}
