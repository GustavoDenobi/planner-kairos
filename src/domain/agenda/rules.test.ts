import { describe, expect, it } from 'vitest';
import {
  eventDisplayTitle,
  resolveEventColor,
  validateEventInput,
  validateEventTypeInput,
  validateProgramItems,
  canWriteEvent,
  eventHasNoAudience,
  extraAudienceMusicianIds,
  validateEventAudienceForGroupWriter,
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

describe('eventHasNoAudience', () => {
  it('is true when no groups or musicians', () => {
    expect(eventHasNoAudience([], [])).toBe(true);
  });

  it('is false when a group is associated', () => {
    expect(eventHasNoAudience(['group-1'], [])).toBe(false);
  });
});

describe('extraAudienceMusicianIds', () => {
  it('excludes the creator musician', () => {
    expect(extraAudienceMusicianIds(['me', 'other'], 'me')).toEqual(['other']);
  });
});

describe('validateEventAudienceForGroupWriter', () => {
  it('rejects a group the writer does not lead or teach', () => {
    expect(
      validateEventAudienceForGroupWriter({
        groupIds: ['other-group'],
        musicianIds: [],
        writableGroupIds: ['class-1'],
        musicianGroupIdsByMusicianId: {},
        creatorMusicianId: 'teacher-1',
      }),
    ).toBe('audience_group_not_allowed');
  });

  it('rejects a musician outside writable groups', () => {
    expect(
      validateEventAudienceForGroupWriter({
        groupIds: ['class-1'],
        musicianIds: ['student-2'],
        writableGroupIds: ['class-1'],
        musicianGroupIdsByMusicianId: {
          'student-2': ['orchestra'],
        },
        creatorMusicianId: 'teacher-1',
      }),
    ).toBe('audience_musician_not_allowed');
  });

  it('allows the creator even without a matching group map', () => {
    expect(
      validateEventAudienceForGroupWriter({
        groupIds: ['class-1'],
        musicianIds: ['teacher-1', 'student-1'],
        writableGroupIds: ['class-1'],
        musicianGroupIdsByMusicianId: {
          'student-1': ['class-1'],
        },
        creatorMusicianId: 'teacher-1',
      }),
    ).toBeNull();
  });
});

describe('canWriteEvent', () => {
  it('allows privileged users', () => {
    expect(
      canWriteEvent({
        isPrivileged: true,
        isGroupWriter: false,
        userId: 'owner',
        createdBy: 'other',
        eventGroupIds: [],
        writableGroupIds: [],
      }),
    ).toBe(true);
  });

  it('allows the group writer who created the event', () => {
    expect(
      canWriteEvent({
        isPrivileged: false,
        isGroupWriter: true,
        userId: 'teacher',
        createdBy: 'teacher',
        eventGroupIds: [],
        writableGroupIds: ['class-1'],
      }),
    ).toBe(true);
  });

  it('allows a writer of an associated group', () => {
    expect(
      canWriteEvent({
        isPrivileged: false,
        isGroupWriter: true,
        userId: 'teacher',
        createdBy: 'owner',
        eventGroupIds: ['class-1'],
        writableGroupIds: ['class-1'],
      }),
    ).toBe(true);
  });

  it('rejects a writer of another group', () => {
    expect(
      canWriteEvent({
        isPrivileged: false,
        isGroupWriter: true,
        userId: 'teacher',
        createdBy: 'owner',
        eventGroupIds: ['orchestra'],
        writableGroupIds: ['class-1'],
      }),
    ).toBe(false);
  });
});
