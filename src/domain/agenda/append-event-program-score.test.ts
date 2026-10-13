import { describe, expect, it } from 'vitest';
import { appendScoreFileToEventProgram } from './append-event-program-score';
import type { ProgramItemDetail } from './program-item';

function row(
  overrides: Partial<ProgramItemDetail> & Pick<ProgramItemDetail, 'id' | 'pieceId'>,
): ProgramItemDetail {
  return {
    organizationId: 'org-1',
    eventId: 'event-1',
    sortOrder: 0,
    notes: null,
    status: 'planned',
    pieceTitle: 'Obra',
    pieceDeleted: false,
    pieceCategory: null,
    fileOrganization: 'single',
    units: [],
    ...overrides,
  };
}

describe('appendScoreFileToEventProgram', () => {
  it('appends a new program row when the piece is not in the program', () => {
    const program: ProgramItemDetail[] = [
      row({
        id: 'p1',
        pieceId: 'piece-a',
        units: [
          {
            id: 'u1',
            pieceFileId: 'file-a',
            sortOrder: 0,
            startPage: null,
            endPage: null,
            navigationShortcutId: null,
            pieceFileTocEntryId: null,
            label: null,
            pieceFileTitle: 'Partitura A',
            navigationShortcutLabel: null,
            navigationShortcutTargetPage: null,
            pieceFileTocEntryLabel: null,
            pieceFileTocEntryTargetPage: null,
            pieceFileTocEntryEndPage: null,
          },
        ],
      }),
    ];

    const next = appendScoreFileToEventProgram(program, 'piece-b', { pieceFileId: 'file-b' });

    expect(next).toHaveLength(2);
    expect(next[1]?.pieceId).toBe('piece-b');
    expect(next[1]?.units).toEqual([{ pieceFileId: 'file-b', sortOrder: 0 }]);
  });

  it('creates a new row for each page of the same file', () => {
    const program: ProgramItemDetail[] = [];

    const afterPage2 = appendScoreFileToEventProgram(program, 'piece-a', {
      pieceFileId: 'file-a',
      startPage: 2,
      endPage: 2,
    });
    expect(afterPage2).toHaveLength(1);
    expect(afterPage2[0]?.units?.[0]).toMatchObject({ startPage: 2, endPage: 2 });

    const afterPage3 = appendScoreFileToEventProgram(
      program.concat([
        {
          ...row({ id: 'p1', pieceId: 'piece-a' }),
          units: [
            {
              id: 'u1',
              pieceFileId: 'file-a',
              sortOrder: 0,
              startPage: 2,
              endPage: 2,
              navigationShortcutId: null,
              pieceFileTocEntryId: null,
              label: null,
              pieceFileTitle: 'Partitura',
              navigationShortcutLabel: null,
              navigationShortcutTargetPage: null,
              pieceFileTocEntryLabel: null,
              pieceFileTocEntryTargetPage: null,
              pieceFileTocEntryEndPage: null,
            },
          ],
        },
      ]),
      'piece-a',
      {
        pieceFileId: 'file-a',
        startPage: 3,
        endPage: 3,
      },
    );

    expect(afterPage3).toHaveLength(2);
    expect(afterPage3[1]?.units?.[0]).toMatchObject({ startPage: 3, endPage: 3 });
  });

  it('creates a new row when the same piece already has a full-file entry', () => {
    const program: ProgramItemDetail[] = [
      row({
        id: 'p1',
        pieceId: 'piece-a',
        fileOrganization: 'single',
        units: [
          {
            id: 'u1',
            pieceFileId: 'file-a',
            sortOrder: 0,
            startPage: null,
            endPage: null,
            navigationShortcutId: null,
            pieceFileTocEntryId: null,
            label: null,
            pieceFileTitle: 'Partitura',
            navigationShortcutLabel: null,
            navigationShortcutTargetPage: null,
            pieceFileTocEntryLabel: null,
            pieceFileTocEntryTargetPage: null,
            pieceFileTocEntryEndPage: null,
          },
        ],
      }),
    ];

    const next = appendScoreFileToEventProgram(program, 'piece-a', {
      pieceFileId: 'file-a',
      startPage: 4,
      endPage: 4,
    });

    expect(next).toHaveLength(2);
    expect(next[1]?.units?.[0]).toMatchObject({ startPage: 4, endPage: 4 });
  });

  it('is idempotent when the exact same trecho already exists', () => {
    const program: ProgramItemDetail[] = [
      row({
        id: 'p1',
        pieceId: 'piece-a',
        units: [
          {
            id: 'u1',
            pieceFileId: 'file-a',
            sortOrder: 0,
            startPage: 2,
            endPage: 2,
            navigationShortcutId: null,
            pieceFileTocEntryId: null,
            label: null,
            pieceFileTitle: 'Partitura',
            navigationShortcutLabel: null,
            navigationShortcutTargetPage: null,
            pieceFileTocEntryLabel: null,
            pieceFileTocEntryTargetPage: null,
            pieceFileTocEntryEndPage: null,
          },
        ],
      }),
    ];

    const next = appendScoreFileToEventProgram(program, 'piece-a', {
      pieceFileId: 'file-a',
      startPage: 2,
      endPage: 2,
    });

    expect(next).toHaveLength(1);
  });
});
