import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_METRONOME_BEATS,
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_VOLUME,
  loadMetronomePreferences,
  loadPdfInvertPreference,
  loadPdfNavigationPreference,
  loadPdfReaderPreferences,
  saveMetronomePreferences,
  savePdfInvertPreference,
  savePdfNavigationPreference,
  savePdfReaderPreferences,
} from './pdf-reader-preference-storage';

const USER_ID = 'user-test-123';

afterEach(() => {
  localStorage.clear();
});

describe('pdf-reader-preference-storage', () => {
  it('defaults to horizontal navigation and no invert', () => {
    expect(loadPdfReaderPreferences(USER_ID)).toEqual({
      inverted: false,
      navigation: 'horizontal',
      metronomeBpm: DEFAULT_METRONOME_BPM,
      metronomeBeatsPerMeasure: DEFAULT_METRONOME_BEATS,
      metronomeVolume: DEFAULT_METRONOME_VOLUME,
    });
  });

  it('persists combined preferences per user', () => {
    savePdfReaderPreferences(USER_ID, { inverted: true, navigation: 'horizontal' });
    expect(loadPdfReaderPreferences(USER_ID)).toEqual({
      inverted: true,
      navigation: 'horizontal',
      metronomeBpm: DEFAULT_METRONOME_BPM,
      metronomeBeatsPerMeasure: DEFAULT_METRONOME_BEATS,
      metronomeVolume: DEFAULT_METRONOME_VOLUME,
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
      inverted: true,
      navigation: 'horizontal',
      metronomeBpm: DEFAULT_METRONOME_BPM,
      metronomeBeatsPerMeasure: DEFAULT_METRONOME_BEATS,
      metronomeVolume: DEFAULT_METRONOME_VOLUME,
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
});
