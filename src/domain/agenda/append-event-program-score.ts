import type { ProgramItemDetail, ProgramItemInput, ProgramItemUnitInput } from './program-item';

export function programUnitIdentityKey(
  unit: Pick<
    ProgramItemUnitInput,
    'pieceFileId' | 'pieceFileTocEntryId' | 'navigationShortcutId' | 'startPage' | 'endPage'
  >,
): string {
  const toc = unit.pieceFileTocEntryId ?? '';
  const shortcut = unit.navigationShortcutId ?? '';
  const start = unit.startPage ?? '';
  const end = unit.endPage ?? '';
  return `file:${unit.pieceFileId}|toc:${toc}|sc:${shortcut}|sp:${start}|ep:${end}`;
}

function programDetailToInput(program: ProgramItemDetail[]): ProgramItemInput[] {
  return program.map((item) => ({
    pieceId: item.pieceId,
    notes: item.notes,
    status: item.status,
    units: item.units.map((unit) => ({
      pieceFileId: unit.pieceFileId,
      sortOrder: unit.sortOrder,
      startPage: unit.startPage,
      endPage: unit.endPage,
      navigationShortcutId: unit.navigationShortcutId,
      pieceFileTocEntryId: unit.pieceFileTocEntryId,
      label: unit.label,
    })),
  }));
}

function unitExistsInProgram(program: ProgramItemDetail[], unit: ProgramItemUnitInput): boolean {
  const key = programUnitIdentityKey(unit);
  for (const item of program) {
    if (item.pieceDeleted) {
      continue;
    }
    for (const existing of item.units) {
      if (programUnitIdentityKey(existing) === key) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Returns an updated program list with the score file appended for historical record.
 * Each call adds a new line in the program (one unit per line).
 * Idempotent only when the exact same trecho already exists.
 */
export function appendScoreFileToEventProgram(
  program: ProgramItemDetail[],
  pieceId: string,
  unit: ProgramItemUnitInput,
): ProgramItemInput[] {
  const inputs = programDetailToInput(program);

  if (unitExistsInProgram(program, unit)) {
    return inputs;
  }

  return [
    ...inputs,
    {
      pieceId,
      status: 'planned',
      units: [{ ...unit, sortOrder: unit.sortOrder ?? 0 }],
    },
  ];
}
