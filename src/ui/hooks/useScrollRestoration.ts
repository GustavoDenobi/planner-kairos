import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_PREFIX = 'kairos:scroll:';

function readSaved(storageKey: string): number {
  try {
    return Number(window.sessionStorage.getItem(storageKey)) || 0;
  } catch {
    return 0;
  }
}

function writeSaved(storageKey: string, value: number) {
  try {
    window.sessionStorage.setItem(storageKey, String(value));
  } catch {
    // Sem sessionStorage (modo privado restrito): só não restaura a rolagem.
  }
}

/**
 * Guarda a rolagem de um contêiner por entrada do histórico e a restaura ao voltar
 * para ela, assim que `ready` indicar que o conteúdo já foi carregado.
 */
export function useScrollRestoration(ref: RefObject<HTMLElement | null>, ready: boolean) {
  const { key } = useLocation();
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const restoredKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!ready || restoredKeyRef.current === storageKey) {
      return;
    }
    restoredKeyRef.current = storageKey;
    const saved = readSaved(storageKey);
    if (ref.current && saved > 0) {
      ref.current.scrollTop = saved;
    }
  }, [ready, storageKey, ref]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let frame = 0;
    const handleScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => writeSaved(storageKey, element.scrollTop));
    };
    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      element.removeEventListener('scroll', handleScroll);
    };
  });
}
