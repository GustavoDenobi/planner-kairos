import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ANNOTATION_TOOL_PREFERENCES,
  DEFAULT_METRONOME_BEATS,
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_VOLUME,
  loadAnnotationToolPreferences,
  loadMetronomePreferences,
  loadPdfInvertPreference,
  loadPdfNavigationPreference,
  loadPdfReaderPreferences,
  saveAnnotationToolPreferences,
  saveMetronomePreferences,
  savePdfInvertPreference,
  savePdfNavigationPreference,
  savePdfReaderPreferences,
} from './pdf-reader-preference-storage';

const USER_ID = 'user-test-123';

const DEFAULTS = {
  inverted: false,
  navigation: 'horizontal' as const,
  metronomeBpm: DEFAULT_METRONOME_BPM,
  metronomeBeatsPerMeasure: DEFAULT_METRONOME_BEATS,
  metronomeVolume: DEFAULT_METRONOME_VOLUME,
  annotationTools: DEFAULT_ANNOTATION_TOOL_PREFERENCES,
};

afterEach(() => {
  localStorage.clear();
});

describe('pdf-reader-preference-storage', () => {
  it('defaults to horizontal navigation and no invert', () => {
    expect(loadPdfReaderPreferences(USER_ID)).toEqual(DEFAULTS);
  });

  it('persists combined preferences per user', () => {
    savePdfReaderPreferences(USER_ID, { inverted: true, navigation: 'horizontal' });
    expect(loadPdfReaderPreferences(USER_ID)).toEqual({
      ...DEFAULTS,
      inverted: true,
    });
  });

  it('updates invert without resetting navigation', () => {
    savePdfNavigationPreference(USER_ID, 'horizontal');
    savePdfInvertPreference(USER_ID, true);

    expect(loadPdfInvertPreference(USER_ID)).toBe(true);
    expect(loadPdfNavigationPreference(USER_ID)).toBe('horizontal');
  });

  it('isolates preferences between users', () => {
    savePdfReaderPreferences('user-a', { inverted: true, navigation: 'horizontal' });
    savePdfReaderPreferences('user-b', { inverted: false, navigation: 'vertical' });

    expect(loadPdfReaderPreferences('user-a').navigation).toBe('horizontal');
    expect(loadPdfReaderPreferences('user-b').inverted).toBe(false);
  });

  it('migrates legacy invert-only storage', () => {
    localStorage.setItem(`planner-kairos:pdf-invert:${USER_ID}`, 'true');
    expect(loadPdfReaderPreferences(USER_ID)).toEqual({
      ...DEFAULTS,
      inverted: true,
    });
  });

  it('persists metronome preferences and clamps invalid values', () => {
    savePdfReaderPreferences(USER_ID, {
      inverted: false,
      navigation: 'vertical',
      metronomeBpm: 999,
      metronomeBeatsPerMeasure: 7,
      metronomeVolume: 2,
    });

    expect(loadPdfReaderPreferences(USER_ID)).toEqual({
      ...DEFAULTS,
      inverted: false,
      navigation: 'vertical',
      metronomeBpm: 208,
      metronomeBeatsPerMeasure: 4,
      metronomeVolume: 1,
    });
  });

  it('updates metronome preferences without resetting navigation', () => {
    savePdfNavigationPreference(USER_ID, 'horizontal');
    saveMetronomePreferences(USER_ID, {
      metronomeBpm: 96,
      metronomeBeatsPerMeasure: 3,
      metronomeVolume: 0.5,
    });

    expect(loadMetronomePreferences(USER_ID)).toEqual({
      metronomeBpm: 96,
      metronomeBeatsPerMeasure: 3,
      metronomeVolume: 0.5,
    });
    expect(loadPdfNavigationPreference(USER_ID)).toBe('horizontal');
  });

  it('persists annotation tool preferences and clamps invalid values', () => {
    saveAnnotationToolPreferences(USER_ID, {
      penPresetId: 'unknown',
      penStrokeWidth: 999,
      highlightPresetId: 'pink',
      highlightStrokeWidth: 0.001,
    });

    expect(loadAnnotationToolPreferences(USER_ID)).toEqual({
      penPresetId: DEFAULT_ANNOTATION_TOOL_PREFERENCES.penPresetId,
      penStrokeWidth: 0.008,
      highlightPresetId: 'pink',
      highlightStrokeWidth: 0.01,
    });
  });

  it('updates annotation tool preferences without resetting navigation', () => {
    savePdfNavigationPreference(USER_ID, 'vertical');
    saveAnnotationToolPreferences(USER_ID, {
      penPresetId: 'red',
      penStrokeWidth: 0.004,
    });

    expect(loadAnnotationToolPreferences(USER_ID)).toMatchObject({
      penPresetId: 'red',
      penStrokeWidth: 0.004,
      highlightPresetId: DEFAULT_ANNOTATION_TOOL_PREFERENCES.highlightPresetId,
    });
    expect(loadPdfNavigationPreference(USER_ID)).toBe('vertical');
  });
});
