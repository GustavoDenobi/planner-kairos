import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  parseUiScaleLevel,
  UI_SCALE_LABELS,
  UI_SCALE_LEVELS,
  UI_SCALE_STORAGE_KEY,
  type UiScaleLevel,
} from '@/ui/theme/tokens';

export type UiScaleContextValue = {
  scale: UiScaleLevel;
  setScale: (scale: UiScaleLevel) => void;
  cycleScale: () => void;
};

export function applyUiScale(scale: UiScaleLevel) {
  document.documentElement.style.fontSize = `${scale}%`;
}

function getInitialScale(): UiScaleLevel {
  if (typeof window === 'undefined') {
    return 100;
  }

  return parseUiScaleLevel(localStorage.getItem(UI_SCALE_STORAGE_KEY));
}

function nextScale(current: UiScaleLevel): UiScaleLevel {
  const index = UI_SCALE_LEVELS.indexOf(current);
  const nextIndex = index === -1 ? 0 : (index + 1) % UI_SCALE_LEVELS.length;
  return UI_SCALE_LEVELS[nextIndex] ?? 100;
}

export function getUiScaleLabel(scale: UiScaleLevel): string {
  return UI_SCALE_LABELS[scale];
}

export function useUiScaleState(): UiScaleContextValue {
  const [scale, setScaleState] = useState<UiScaleLevel>(getInitialScale);

  useEffect(() => {
    applyUiScale(scale);
    localStorage.setItem(UI_SCALE_STORAGE_KEY, String(scale));
  }, [scale]);

  const setScale = useCallback((next: UiScaleLevel) => {
    setScaleState(next);
  }, []);

  const cycleScale = useCallback(() => {
    setScaleState((current) => nextScale(current));
  }, []);

  return useMemo(
    () => ({ scale, setScale, cycleScale }),
    [scale, setScale, cycleScale],
  );
}
