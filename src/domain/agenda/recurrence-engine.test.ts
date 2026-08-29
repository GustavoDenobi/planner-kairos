import { describe, expect, it } from 'vitest';
import {
  generateOccurrenceDates,
  formatRecurrencePreview,
  maxRecurrenceEndDate,
  maxRecurrenceEndDateInputValue,
  validateRecurrenceEndDate,
} from '@/domain/agenda/recurrence-engine';

describe('recurrence-engine', () => {
  it('generates weekly occurrences until series end', () => {
    const occurrences = generateOccurrenceDates({
      rule: { frequency: 'weekly', interval: 1, byWeekday: [6] },
      seriesStartsAt: '2026-08-01T12:00:00.000Z',
      seriesEndsAt: '2026-08-31',
      durationMinutes: 120,
    });

    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences.every((item) => new Date(item.startsAt).getUTCDay() === 6)).toBe(true);
    expect(occurrences[0]?.endsAt).toBe('2026-08-01T14:00:00.000Z');
    expect(occurrences.at(-1)?.startsAt).toMatch(/^2026-08-2/);
  });

  it('generates monthly day-of-month occurrences using last valid day', () => {
    const occurrences = generateOccurrenceDates({
      rule: { frequency: 'monthly', mode: 'dayOfMonth', day: 31, interval: 1 },
      seriesStartsAt: '2026-01-31T09:00:00.000Z',
      seriesEndsAt: '2026-06-30',
      durationMinutes: null,
    });

    expect(occurrences.map((item) => item.startsAt.slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ]);
  });

  it('generates monthly nth weekday occurrences', () => {
    const occurrences = generateOccurrenceDates({
      rule: {
        frequency: 'monthly',
        mode: 'nthWeekday',
        weekday: 6,
        nth: 2,
        interval: 1,
      },
      seriesStartsAt: '2026-08-01T09:00:00.000Z',
      seriesEndsAt: '2026-10-31',
      durationMinutes: null,
    });

    expect(occurrences.map((item) => item.startsAt.slice(0, 10))).toEqual([
      '2026-08-08',
      '2026-09-12',
      '2026-10-10',
    ]);
  });

  it('caps end date at 730 days from anchor', () => {
    const anchor = '2026-01-01T10:00:00.000Z';
    const maxEnd = maxRecurrenceEndDate(anchor);
    expect(maxRecurrenceEndDateInputValue(anchor)).toBe('2028-01-01');
    expect(validateRecurrenceEndDate({
      seriesStartsAt: anchor,
      seriesEndsAt: '2028-01-02',
      limitAnchorAt: anchor,
    })).toBe('end_date_beyond_limit');
    expect(maxEnd.toISOString()).toBe('2028-01-01T23:59:59.999Z');
  });

  it('requires end date', () => {
    expect(
      validateRecurrenceEndDate({
        seriesStartsAt: '2026-01-01T10:00:00.000Z',
        seriesEndsAt: '',
        limitAnchorAt: '2026-01-01T10:00:00.000Z',
      }),
    ).toBe('end_date_required');
  });

  it('formatRecurrencePreview tolerates incomplete end date while editing', () => {
    expect(
      formatRecurrencePreview(
        { frequency: 'weekly', interval: 1, byWeekday: [6] },
        '',
      ),
    ).toBe('Informe a data limite da recorrência.');
    expect(
      formatRecurrencePreview(
        { frequency: 'weekly', interval: 1, byWeekday: [6] },
        '2026-08',
      ),
    ).toBe('Informe a data limite da recorrência.');
  });
});
