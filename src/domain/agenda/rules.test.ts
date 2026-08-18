import { describe, expect, it } from 'vitest';
import {
  eventDisplayTitle,
  resolveEventColor,
  validateEventInput,
  validateEventTypeInput,
  validateProgramItems,
} from './rules';

describe('validateEventTypeInput', () => {
  it('rejects empty name', () => {
    expect(
      validateEventTypeInput({ name: '', kind: 'service' }),
    ).toBe('invalid_name');
  });

  it('accepts valid input', () => {
    expect(
      validateEventTypeInput({ name: 'Culto de domingo', kind: 'service' }),
    ).toBeNull();
  });
});

describe('validateEventInput', () => {
  it('rejects missing type', () => {
    expect(
      validateEventInput({
        typeId: '',
        startsAt: '2026-08-18T10:00:00.000Z',
      }),
    ).toBe('invalid_type');
  });

  it('rejects invalid startsAt', () => {
    expect(
      validateEventInput({
        typeId: 'type-1',
        startsAt: 'not-a-date',
      }),
    ).toBe('invalid_dates');
  });

  it('rejects endsAt before startsAt', () => {
    expect(
      validateEventInput({
        typeId: 'type-1',
        startsAt: '2026-08-18T12:00:00.000Z',
        endsAt: '2026-08-18T10:00:00.000Z',
      }),
    ).toBe('invalid_dates');
  });

  it('accepts valid event without endsAt', () => {
    expect(
      validateEventInput({
        typeId: 'type-1',
        startsAt: '2026-08-18T10:00:00.000Z',
      }),
    ).toBeNull();
  });
});

describe('validateProgramItems', () => {
  it('accepts empty program', () => {
    expect(validateProgramItems([])).toBeNull();
  });

  it('rejects duplicate pieces', () => {
    expect(
      validateProgramItems([
        { pieceId: 'piece-1' },
        { pieceId: 'piece-1' },
      ]),
    ).toBe('duplicate_piece');
  });
});

describe('resolveEventColor', () => {
  it('uses type color when set', () => {
    expect(
      resolveEventColor({ kind: 'service', color: 'rose-500' }),
    ).toBe('rose-500');
  });

  it('falls back to kind color', () => {
    expect(
      resolveEventColor({ kind: 'rehearsal', color: null }),
    ).toBe('blue-500');
  });
});

describe('eventDisplayTitle', () => {
  it('uses custom title when present', () => {
    expect(
      eventDisplayTitle({ title: 'Cantata de Natal' }, { name: 'Culto de domingo' }),
    ).toBe('Cantata de Natal');
  });

  it('falls back to type name', () => {
    expect(
      eventDisplayTitle({ title: null }, { name: 'Culto de domingo' }),
    ).toBe('Culto de domingo');
  });
});
