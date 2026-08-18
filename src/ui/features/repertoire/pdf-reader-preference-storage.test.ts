import { afterEach, describe, expect, it } from 'vitest';
import {
  loadPdfInvertPreference,
  loadPdfNavigationPreference,
  loadPdfReaderPreferences,
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
    });
  });

  it('persists combined preferences per user', () => {
    savePdfReaderPreferences(USER_ID, { inverted: true, navigation: 'horizontal' });
    expect(loadPdfReaderPreferences(USER_ID)).toEqual({
      inverted: true,
      navigation: 'horizontal',
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
    });
  });
});
