import {
  clampMetronomeBpm,
  normalizeBeatsPerMeasure,
} from '@/ui/features/repertoire/metronome-engine';
import {
  clampStrokeWidth,
  COVER_STROKE_WIDTH,
  findPreset,
  HIGHLIGHT_STROKE_WIDTH,
  PEN_COLOR_PRESETS,
  PEN_STROKE_WIDTH,
  DEFAULT_TEXT_FONT_FAMILY,
  TEXT_FONT_SIZE,
  normalizeTextFontFamily,
  type TextFontFamily,
} from '@/domain/repertoire';
import type { CoverDrawMode, HighlightStrokeMode } from '@/ui/features/repertoire/highlight-brush';

export type PdfNavigationMode = 'vertical' | 'horizontal';

export type AnnotationToolPreferences = {
  penPresetId: string;
  penStrokeWidth: number;
  highlightPresetId: string;
  highlightStrokeWidth: number;
  highlightStrokeMode: HighlightStrokeMode;
  coverStrokeWidth: number;
  coverDrawMode: CoverDrawMode;
  textPresetId: string;
  textFontSize: number;
  textFontFamily: TextFontFamily;
};

export type PdfReaderPreferences = {
  inverted: boolean;
  navigation: PdfNavigationMode;
  navigationShortcutsVisible?: boolean;
  metronomeBpm?: number;
  metronomeBeatsPerMeasure?: number;
  metronomeVolume?: number;
  annotationTools?: AnnotationToolPreferences;
};

const STORAGE_KEY = 'planner-kairos:pdf-reader';
const LEGACY_INVERT_KEY = 'planner-kairos:pdf-invert';

export const DEFAULT_METRONOME_BPM = 120;
export const DEFAULT_METRONOME_BEATS = 1;
export const DEFAULT_METRONOME_VOLUME = 0.8;

export const DEFAULT_ANNOTATION_TOOL_PREFERENCES: AnnotationToolPreferences = {
  penPresetId: PEN_COLOR_PRESETS[0]!.id,
  penStrokeWidth: PEN_STROKE_WIDTH.default,
  highlightPresetId: 'yellow',
  highlightStrokeWidth: HIGHLIGHT_STROKE_WIDTH.default,
  highlightStrokeMode: 'free',
  coverStrokeWidth: COVER_STROKE_WIDTH.default,
  coverDrawMode: 'free',
  textPresetId: PEN_COLOR_PRESETS[0]!.id,
  textFontSize: TEXT_FONT_SIZE.default,
  textFontFamily: DEFAULT_TEXT_FONT_FAMILY,
};

const DEFAULT_PREFERENCES: PdfReaderPreferences = {
  inverted: false,
  navigation: 'horizontal',
  navigationShortcutsVisible: true,
  metronomeBpm: DEFAULT_METRONOME_BPM,
  metronomeBeatsPerMeasure: DEFAULT_METRONOME_BEATS,
  metronomeVolume: DEFAULT_METRONOME_VOLUME,
  annotationTools: DEFAULT_ANNOTATION_TOOL_PREFERENCES,
};

function storageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`;
}

function legacyInvertKey(userId: string): string {
  return `${LEGACY_INVERT_KEY}:${userId}`;
}

function parseHighlightStrokeMode(
  value: unknown,
  legacyHorizontal?: boolean,
): HighlightStrokeMode {
  if (
    value === 'free'
    || value === 'horizontal'
    || value === 'vertical'
    || value === 'rect'
  ) {
    return value;
  }
  return legacyHorizontal === true ? 'horizontal' : 'free';
}

function parseCoverDrawMode(value: unknown): CoverDrawMode {
  return parseHighlightStrokeMode(value);
}

function parseMetronomeVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_METRONOME_VOLUME;
  }
  return Math.min(1, Math.max(0, value));
}

function parseMetronomePreferences(
  parsed: Partial<PdfReaderPreferences>,
): Pick<
  PdfReaderPreferences,
  'metronomeBpm' | 'metronomeBeatsPerMeasure' | 'metronomeVolume'
> {
  return {
    metronomeBpm:
      typeof parsed.metronomeBpm === 'number'
        ? clampMetronomeBpm(parsed.metronomeBpm)
        : DEFAULT_METRONOME_BPM,
    metronomeBeatsPerMeasure:
      typeof parsed.metronomeBeatsPerMeasure === 'number'
        ? normalizeBeatsPerMeasure(parsed.metronomeBeatsPerMeasure)
        : DEFAULT_METRONOME_BEATS,
    metronomeVolume: parseMetronomeVolume(parsed.metronomeVolume),
  };
}

function parseAnnotationToolPreferences(
  parsed: Partial<PdfReaderPreferences>,
): AnnotationToolPreferences {
  const raw = parsed.annotationTools;
  const penPresetId =
    typeof raw?.penPresetId === 'string' && raw.penPresetId.trim()
      ? findPreset('stroke', raw.penPresetId).id
      : DEFAULT_ANNOTATION_TOOL_PREFERENCES.penPresetId;
  const highlightPresetId =
    typeof raw?.highlightPresetId === 'string' && raw.highlightPresetId.trim()
      ? findPreset('highlight', raw.highlightPresetId).id
      : DEFAULT_ANNOTATION_TOOL_PREFERENCES.highlightPresetId;
  const textPresetId =
    typeof raw?.textPresetId === 'string' && raw.textPresetId.trim()
      ? findPreset('text', raw.textPresetId).id
      : DEFAULT_ANNOTATION_TOOL_PREFERENCES.textPresetId;

  return {
    penPresetId,
    penStrokeWidth: clampStrokeWidth(
      typeof raw?.penStrokeWidth === 'number'
        ? raw.penStrokeWidth
        : DEFAULT_ANNOTATION_TOOL_PREFERENCES.penStrokeWidth,
      PEN_STROKE_WIDTH,
    ),
    highlightPresetId,
    highlightStrokeWidth: clampStrokeWidth(
      typeof raw?.highlightStrokeWidth === 'number'
        ? raw.highlightStrokeWidth
        : DEFAULT_ANNOTATION_TOOL_PREFERENCES.highlightStrokeWidth,
      HIGHLIGHT_STROKE_WIDTH,
    ),
    highlightStrokeMode: parseHighlightStrokeMode(
      raw?.highlightStrokeMode,
      raw?.highlightHorizontal,
    ),
    coverStrokeWidth: clampStrokeWidth(
      typeof raw?.coverStrokeWidth === 'number'
        ? raw.coverStrokeWidth
        : DEFAULT_ANNOTATION_TOOL_PREFERENCES.coverStrokeWidth,
      COVER_STROKE_WIDTH,
    ),
    coverDrawMode: parseCoverDrawMode(raw?.coverDrawMode),
    textPresetId,
    textFontSize: clampStrokeWidth(
      typeof raw?.textFontSize === 'number'
        ? raw.textFontSize
        : DEFAULT_ANNOTATION_TOOL_PREFERENCES.textFontSize,
      TEXT_FONT_SIZE,
    ),
    textFontFamily: normalizeTextFontFamily(
      raw?.textFontFamily ?? DEFAULT_ANNOTATION_TOOL_PREFERENCES.textFontFamily,
    ),
  };
}

export function loadPdfReaderPreferences(userId: string): PdfReaderPreferences {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PdfReaderPreferences>;
      return {
        inverted: parsed.inverted === true,
        navigation: parsed.navigation === 'horizontal' ? 'horizontal' : 'vertical',
        navigationShortcutsVisible: parsed.navigationShortcutsVisible !== false,
        ...parseMetronomePreferences(parsed),
        annotationTools: parseAnnotationToolPreferences(parsed),
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

export function loadNavigationShortcutsVisible(userId: string): boolean {
  return loadPdfReaderPreferences(userId).navigationShortcutsVisible !== false;
}

export function saveNavigationShortcutsVisible(userId: string, visible: boolean): void {
  const current = loadPdfReaderPreferences(userId);
  savePdfReaderPreferences(userId, { ...current, navigationShortcutsVisible: visible });
}

export function loadMetronomePreferences(userId: string): Pick<
  PdfReaderPreferences,
  'metronomeBpm' | 'metronomeBeatsPerMeasure' | 'metronomeVolume'
> {
  const preferences = loadPdfReaderPreferences(userId);
  return {
    metronomeBpm: preferences.metronomeBpm ?? DEFAULT_METRONOME_BPM,
    metronomeBeatsPerMeasure:
      preferences.metronomeBeatsPerMeasure ?? DEFAULT_METRONOME_BEATS,
    metronomeVolume: preferences.metronomeVolume ?? DEFAULT_METRONOME_VOLUME,
  };
}

export function saveMetronomePreferences(
  userId: string,
  patch: Partial<
    Pick<
      PdfReaderPreferences,
      'metronomeBpm' | 'metronomeBeatsPerMeasure' | 'metronomeVolume'
    >
  >,
): void {
  const current = loadPdfReaderPreferences(userId);
  savePdfReaderPreferences(userId, {
    ...current,
    ...patch,
  });
}

export function loadAnnotationToolPreferences(userId: string): AnnotationToolPreferences {
  return loadPdfReaderPreferences(userId).annotationTools ?? DEFAULT_ANNOTATION_TOOL_PREFERENCES;
}

export function saveAnnotationToolPreferences(
  userId: string,
  patch: Partial<AnnotationToolPreferences>,
): void {
  const current = loadPdfReaderPreferences(userId);
  const merged = {
    ...(current.annotationTools ?? DEFAULT_ANNOTATION_TOOL_PREFERENCES),
    ...patch,
  };
  savePdfReaderPreferences(userId, {
    ...current,
    annotationTools: {
      penPresetId: findPreset('stroke', merged.penPresetId).id,
      penStrokeWidth: clampStrokeWidth(merged.penStrokeWidth, PEN_STROKE_WIDTH),
      highlightPresetId: findPreset('highlight', merged.highlightPresetId).id,
      highlightStrokeWidth: clampStrokeWidth(
        merged.highlightStrokeWidth,
        HIGHLIGHT_STROKE_WIDTH,
      ),
      highlightStrokeMode: parseHighlightStrokeMode(merged.highlightStrokeMode),
      coverStrokeWidth: clampStrokeWidth(merged.coverStrokeWidth, COVER_STROKE_WIDTH),
      coverDrawMode: parseCoverDrawMode(merged.coverDrawMode),
      textPresetId: findPreset('text', merged.textPresetId).id,
      textFontSize: clampStrokeWidth(merged.textFontSize, TEXT_FONT_SIZE),
      textFontFamily: normalizeTextFontFamily(merged.textFontFamily),
    },
  });
}
