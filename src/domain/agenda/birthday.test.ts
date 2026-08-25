import { describe, expect, it } from 'vitest';
import { listMusicianBirthdaysInRange } from './birthday';

const emptyAssignments: never[] = [];

describe('listMusicianBirthdaysInRange', () => {
  const musicians = [
    { id: 'm1', fullName: 'Ana Silva', birthDate: '1990-05-15', assignments: emptyAssignments },
    { id: 'm2', fullName: 'Bruno Costa', birthDate: '2000-12-30', assignments: emptyAssignments },
    { id: 'm3', fullName: 'Carla Dias', birthDate: '1988-02-29', assignments: emptyAssignments },
    { id: 'm4', fullName: 'Sem data', birthDate: '', assignments: emptyAssignments },
  ];

  it('lists birthdays within a normal week', () => {
    const result = listMusicianBirthdaysInRange(
      musicians,
      '2026-05-11T00:00:00.000Z',
      '2026-05-18T00:00:00.000Z',
    );

    expect(result).toEqual([
      {
        musicianId: 'm1',
        fullName: 'Ana Silva',
        date: new Date(2026, 4, 15).toISOString(),
        ageTurning: 36,
        assignments: [],
      },
    ]);
  });

  it('handles year boundary in the visible range', () => {
    const result = listMusicianBirthdaysInRange(
      musicians,
      '2025-12-28T00:00:00.000Z',
      '2026-01-04T00:00:00.000Z',
    );

    expect(result).toEqual([
      {
        musicianId: 'm2',
        fullName: 'Bruno Costa',
        date: new Date(2025, 11, 30).toISOString(),
        ageTurning: 25,
        assignments: [],
      },
    ]);
  });

  it('maps Feb 29 birthdays to Feb 28 in non-leap years', () => {
    const result = listMusicianBirthdaysInRange(
      musicians,
      '2026-02-23T00:00:00.000Z',
      '2026-03-02T00:00:00.000Z',
    );

    expect(result).toEqual([
      {
        musicianId: 'm3',
        fullName: 'Carla Dias',
        date: new Date(2026, 1, 28).toISOString(),
        ageTurning: 38,
        assignments: [],
      },
    ]);
  });

  it('keeps Feb 29 on leap years', () => {
    const result = listMusicianBirthdaysInRange(
      musicians,
      '2028-02-26T00:00:00.000Z',
      '2028-03-03T00:00:00.000Z',
    );

    expect(result).toEqual([
      {
        musicianId: 'm3',
        fullName: 'Carla Dias',
        date: new Date(2028, 1, 29).toISOString(),
        ageTurning: 40,
        assignments: [],
      },
    ]);
  });

  it('sorts by date then by name when multiple fall on the same day', () => {
    const result = listMusicianBirthdaysInRange(
      [
        { id: 'z', fullName: 'Zeca', birthDate: '1990-05-15', assignments: emptyAssignments },
        { id: 'a', fullName: 'Ana', birthDate: '1985-05-15', assignments: emptyAssignments },
        { id: 'b', fullName: 'Bruno', birthDate: '1992-05-16', assignments: emptyAssignments },
      ],
      '2026-05-11T00:00:00.000Z',
      '2026-05-18T00:00:00.000Z',
    );

    expect(result.map((item) => item.fullName)).toEqual(['Ana', 'Zeca', 'Bruno']);
  });

  it('filters by allowed musician ids', () => {
    const result = listMusicianBirthdaysInRange(
      musicians,
      '2026-05-11T00:00:00.000Z',
      '2026-05-18T00:00:00.000Z',
      { allowedMusicianIds: new Set(['m9']) },
    );

    expect(result).toEqual([]);
  });

  it('filters displayed assignments by group id', () => {
    const result = listMusicianBirthdaysInRange(
      [
        {
          id: 'm1',
          fullName: 'Ana Silva',
          birthDate: '1990-05-15',
          assignments: [
            {
              groupId: 'g1',
              groupName: 'Orquestra',
              ensembleRole: 'member',
              sectionName: 'Cordas',
              partName: 'Violino',
            },
            {
              groupId: 'g2',
              groupName: 'Big Band',
              ensembleRole: 'member',
              sectionName: null,
              partName: 'Sax alto',
            },
          ],
        },
      ],
      '2026-05-11T00:00:00.000Z',
      '2026-05-18T00:00:00.000Z',
      { groupId: 'g2' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.assignments).toEqual([
      {
        groupId: 'g2',
        groupName: 'Big Band',
        ensembleRole: 'member',
        sectionName: null,
        partName: 'Sax alto',
      },
    ]);
  });
});
