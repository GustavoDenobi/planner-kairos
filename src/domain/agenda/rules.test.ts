import { describe, expect, it } from 'vitest';
import { groupEventParticipants } from './absence-grouping';
import type { EventParticipant, EventParticipantAssignment } from './event-absence';
import {
  eventDisplayTitle,
  resolveEventColor,
  validateEventInput,
  validateEventTypeInput,
  validateProgramItems,
  canWriteEvent,
  eventHasNoAudience,
  extraAudienceMusicianIds,
  resolveEventParticipants,
  validateEventAudienceForGroupWriter,
} from './rules';

function participantAssignment(
  overrides: Partial<EventParticipantAssignment> &
    Pick<EventParticipantAssignment, 'musicianId' | 'musicianName' | 'groupName'>,
): EventParticipantAssignment {
  return {
    groupId: overrides.groupName,
    sectionId: null,
    sectionName: null,
    sectionSortOrder: null,
    partId: null,
    partName: null,
    ...overrides,
  };
}

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

  it('allows duplicate pieces in program', () => {
    expect(
      validateProgramItems(
        [
          { pieceId: 'method-1', units: [{ pieceFileId: 'lesson-1' }] },
          { pieceId: 'method-1', units: [{ pieceFileId: 'lesson-2' }] },
        ],
        {
          piecesById: new Map([
            [
              'method-1',
              {
                fileOrganization: 'sequential',
                files: [
                  { id: 'lesson-1', kind: 'score', partLinkCount: 0, tocEntryIds: new Set() },
                  { id: 'lesson-2', kind: 'score', partLinkCount: 0, tocEntryIds: new Set() },
                ],
              },
            ],
          ]),
        },
      ),
    ).toBeNull();

    expect(
      validateProgramItems(
        [{ pieceId: 'piece-1' }, { pieceId: 'piece-1' }],
        {
          piecesById: new Map([
            [
              'piece-1',
              {
                fileOrganization: 'distributed',
                files: [{ id: 'score-1', kind: 'score', partLinkCount: 1, tocEntryIds: new Set() }],
              },
            ],
          ]),
        },
      ),
    ).toBeNull();
  });

  it('rejects distributed unit on part-linked file', () => {
    expect(
      validateProgramItems(
        [{ pieceId: 'piece-1', units: [{ pieceFileId: 'violin' }] }],
        {
          piecesById: new Map([
            [
              'piece-1',
              {
                fileOrganization: 'distributed',
                files: [
                  { id: 'violin', kind: 'score', partLinkCount: 1, tocEntryIds: new Set() },
                  { id: 'general', kind: 'score', partLinkCount: 0, tocEntryIds: new Set() },
                ],
              },
            ],
          ]),
        },
      ),
    ).toBe('distributed_general_score_only');
  });

  it('accepts items without explicit status', () => {
    expect(validateProgramItems([{ pieceId: 'piece-1' }])).toBeNull();
  });

  it('accepts valid statuses', () => {
    expect(
      validateProgramItems([
        { pieceId: 'piece-1', status: 'planned' },
        { pieceId: 'piece-2', status: 'performed' },
        { pieceId: 'piece-3', status: 'skipped' },
      ]),
    ).toBeNull();
  });

  it('rejects invalid status', () => {
    expect(
      validateProgramItems([
        { pieceId: 'piece-1', status: 'cancelled' as 'planned' },
      ]),
    ).toBe('invalid_status');
  });

  it('allows multiple TOC units on the same file', () => {
    const tocIds = new Set(['toc-1', 'toc-2']);
    expect(
      validateProgramItems(
        [
          {
            pieceId: 'method-1',
            units: [
              { pieceFileId: 'pdf-1', pieceFileTocEntryId: 'toc-1' },
              { pieceFileId: 'pdf-1', pieceFileTocEntryId: 'toc-2' },
            ],
          },
        ],
        {
          piecesById: new Map([
            [
              'method-1',
              {
                fileOrganization: 'sequential',
                files: [{ id: 'pdf-1', kind: 'score', partLinkCount: 0, tocEntryIds: tocIds }],
              },
            ],
          ]),
        },
      ),
    ).toBeNull();
  });

  it('rejects duplicate TOC entries in the same program item', () => {
    const tocIds = new Set(['toc-1']);
    expect(
      validateProgramItems(
        [
          {
            pieceId: 'method-1',
            units: [
              { pieceFileId: 'pdf-1', pieceFileTocEntryId: 'toc-1' },
              { pieceFileId: 'pdf-1', pieceFileTocEntryId: 'toc-1' },
            ],
          },
        ],
        {
          piecesById: new Map([
            [
              'method-1',
              {
                fileOrganization: 'sequential',
                files: [{ id: 'pdf-1', kind: 'score', partLinkCount: 0, tocEntryIds: tocIds }],
              },
            ],
          ]),
        },
      ),
    ).toBe('duplicate_toc_entry');
  });

  it('rejects invalid toc entry reference', () => {
    expect(
      validateProgramItems(
        [{ pieceId: 'method-1', units: [{ pieceFileId: 'pdf-1', pieceFileTocEntryId: 'toc-x' }] }],
        {
          piecesById: new Map([
            [
              'method-1',
              {
                fileOrganization: 'single',
                files: [{ id: 'pdf-1', kind: 'score', partLinkCount: 0, tocEntryIds: new Set() }],
              },
            ],
          ]),
        },
      ),
    ).toBe('invalid_toc_entry');
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

describe('resolveEventParticipants', () => {
  it('merges group members and direct musicians without duplicates', () => {
    const result = resolveEventParticipants({
      groupAssignments: [
        participantAssignment({ musicianId: 'm1', musicianName: 'Ana', groupName: 'Orquestra' }),
        participantAssignment({ musicianId: 'm2', musicianName: 'Bruno', groupName: 'Orquestra' }),
      ],
      directMusicians: [
        { id: 'm2', fullName: 'Bruno Silva', userId: null },
        { id: 'm3', fullName: 'Carlos', userId: null },
      ],
      partNamesByMusicianId: new Map([
        ['m1', ['Violino']],
        ['m2', ['Viola']],
      ]),
    });

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.musicianId)).toEqual(['m1', 'm2', 'm3']);
    expect(result[0]?.groupNames).toEqual(['Orquestra']);
    expect(result[0]?.partNames).toEqual(['Violino']);
    expect(result[0]?.memberships).toHaveLength(1);
    expect(result[1]?.fullName).toBe('Bruno');
    expect(result[1]?.groupNames).toEqual(['Orquestra']);
    expect(result[1]?.partNames).toEqual(['Viola']);
    expect(result[2]?.groupNames).toEqual([]);
    expect(result[2]?.memberships).toEqual([]);
  });

  it('collects multiple group names for the same musician', () => {
    const result = resolveEventParticipants({
      groupAssignments: [
        participantAssignment({ musicianId: 'm1', musicianName: 'Ana', groupName: 'Coro' }),
        participantAssignment({ musicianId: 'm1', musicianName: 'Ana', groupName: 'Orquestra' }),
      ],
      directMusicians: [],
      partNamesByMusicianId: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.groupNames).toEqual(['Coro', 'Orquestra']);
    expect(result[0]?.memberships).toHaveLength(2);
  });

  it('sorts participants by name in pt-BR locale', () => {
    const result = resolveEventParticipants({
      groupAssignments: [
        participantAssignment({ musicianId: 'm1', musicianName: 'Zélia', groupName: 'Grupo A' }),
        participantAssignment({ musicianId: 'm2', musicianName: 'Álvaro', groupName: 'Grupo B' }),
      ],
      directMusicians: [],
      partNamesByMusicianId: new Map(),
    });

    expect(result.map((item) => item.fullName)).toEqual(['Álvaro', 'Zélia']);
  });

  it('returns empty list when no participants', () => {
    expect(
      resolveEventParticipants({
        groupAssignments: [],
        directMusicians: [],
        partNamesByMusicianId: new Map(),
      }),
    ).toEqual([]);
  });
});

function participant(overrides: Partial<EventParticipant> & Pick<EventParticipant, 'musicianId' | 'fullName'>): EventParticipant {
  return {
    groupNames: [],
    partNames: [],
    memberships: [],
    ...overrides,
  };
}

describe('groupEventParticipants', () => {
  const ana = participant({
    musicianId: 'ana',
    fullName: 'Ana',
    groupNames: ['Coro', 'Orquestra'],
    partNames: ['Trompete'],
    memberships: [
      {
        groupId: 'coro',
        groupName: 'Coro',
        sectionId: 'sopranos',
        sectionName: 'Sopranos',
        sectionSortOrder: 1,
        partId: 'soprano',
        partName: 'Soprano',
      },
      {
        groupId: 'orquestra',
        groupName: 'Orquestra',
        sectionId: 'cordas',
        sectionName: 'Cordas',
        sectionSortOrder: 1,
        partId: 'violino',
        partName: 'Violino',
      },
      {
        groupId: 'orquestra',
        groupName: 'Orquestra',
        sectionId: 'metais',
        sectionName: 'Metais',
        sectionSortOrder: 2,
        partId: 'violino',
        partName: 'Violino',
      },
    ],
  });
  const bruno = participant({
    musicianId: 'bruno',
    fullName: 'Bruno',
    groupNames: ['Orquestra'],
    partNames: ['Trompete'],
    memberships: [
      {
        groupId: 'orquestra',
        groupName: 'Orquestra',
        sectionId: null,
        sectionName: null,
        sectionSortOrder: null,
        partId: null,
        partName: null,
      },
    ],
  });
  const carlos = participant({
    musicianId: 'carlos',
    fullName: 'Carlos',
    partNames: ['Viola'],
  });

  it('repeats a musician in each section and keeps people without a section at the end', () => {
    const buckets = groupEventParticipants([ana, bruno, carlos], 'section', 2);

    expect(buckets.map((bucket) => bucket.label)).toEqual([
      'Sopranos · Coro',
      'Cordas · Orquestra',
      'Metais · Orquestra',
      'Sem naipe',
    ]);
    expect(buckets[0]?.participants.map((item) => item.musicianId)).toEqual(['ana']);
    expect(buckets[1]?.participants.map((item) => item.musicianId)).toEqual(['ana']);
    expect(buckets[2]?.participants.map((item) => item.musicianId)).toEqual(['ana']);
    expect(buckets[3]?.participants.map((item) => item.musicianId)).toEqual(['bruno', 'carlos']);
  });

  it('uses only the section name when the event has one group', () => {
    const buckets = groupEventParticipants([ana], 'section', 1);
    expect(buckets.map((bucket) => bucket.label)).toEqual(['Sopranos', 'Cordas', 'Metais']);
  });

  it('keeps the same part as one bucket and falls back to part names only for direct musicians', () => {
    const buckets = groupEventParticipants([ana, bruno, carlos], 'part');

    expect(buckets.map((bucket) => bucket.label)).toEqual(['Soprano', 'Viola', 'Violino', 'Sem parte']);
    expect(buckets.find((bucket) => bucket.label === 'Violino')?.participants).toHaveLength(1);
    expect(buckets.find((bucket) => bucket.label === 'Sem parte')?.participants.map((item) => item.musicianId)).toEqual([
      'bruno',
    ]);
    expect(buckets.find((bucket) => bucket.label === 'Viola')?.participants.map((item) => item.musicianId)).toEqual([
      'carlos',
    ]);
  });

  it('repeats a musician in each group', () => {
    const buckets = groupEventParticipants([ana, bruno, carlos], 'group');

    expect(buckets.map((bucket) => bucket.label)).toEqual(['Coro', 'Orquestra', 'Sem grupo']);
    expect(buckets[0]?.participants.map((item) => item.musicianId)).toEqual(['ana']);
    expect(buckets[1]?.participants.map((item) => item.musicianId)).toEqual(['ana', 'bruno']);
    expect(buckets[2]?.participants.map((item) => item.musicianId)).toEqual(['carlos']);
  });

  it('returns a single unnamed bucket when grouping by name', () => {
    const buckets = groupEventParticipants([carlos, ana], 'name');
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.label).toBe('');
    expect(buckets[0]?.participants.map((item) => item.fullName)).toEqual(['Ana', 'Carlos']);
  });
});
