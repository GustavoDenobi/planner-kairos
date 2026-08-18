export type PdfNavigationMode = 'vertical' | 'horizontal';

export type PdfReaderPreferences = {
  inverted: boolean;
  navigation: PdfNavigationMode;
};

const STORAGE_KEY = 'planner-kairos:pdf-reader';
const LEGACY_INVERT_KEY = 'planner-kairos:pdf-invert';

const DEFAULT_PREFERENCES: PdfReaderPreferences = {
  inverted: false,
  navigation: 'horizontal',
};

function storageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`;
}

function legacyInvertKey(userId: string): string {
  return `${LEGACY_INVERT_KEY}:${userId}`;
}

export function loadPdfReaderPreferences(userId: string): PdfReaderPreferences {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PdfReaderPreferences>;
      return {
        inverted: parsed.inverted === true,
        navigation: parsed.navigation === 'horizontal' ? 'horizontal' : 'vertical',
      };
    }

    const legacyInvert = localStorage.getItem(legacyInvertKey(userId));
    if (legacyInvert !== null) {
      return { ...DEFAULT_PREFERENCES, inverted: legacyInvert === 'true' };
    }

    return DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePdfReaderPreferences(userId: string, preferences: PdfReaderPreferences): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
  } catch {
    // ignore storage errors
  }
}

export function loadPdfInvertPreference(userId: string): boolean {
  return loadPdfReaderPreferences(userId).inverted;
}

export function savePdfInvertPreference(userId: string, inverted: boolean): void {
  const current = loadPdfReaderPreferences(userId);
  savePdfReaderPreferences(userId, { ...current, inverted });
}

export function loadPdfNavigationPreference(userId: string): PdfNavigationMode {
  return loadPdfReaderPreferences(userId).navigation;
}

export function savePdfNavigationPreference(userId: string, navigation: PdfNavigationMode): void {
  const current = loadPdfReaderPreferences(userId);
  savePdfReaderPreferences(userId, { ...current, navigation });
}
