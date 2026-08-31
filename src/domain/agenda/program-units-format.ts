import type { ProgramItemUnitDetail } from './program-item';

function formatPageRange(startPage: number | null, endPage: number | null): string | null {
  if (startPage == null && endPage == null) {
    return null;
  }
  if (startPage != null && endPage != null && endPage !== startPage) {
    return `p. ${startPage}–${endPage}`;
  }
  const page = startPage ?? endPage;
  return page != null ? `p. ${page}` : null;
}

export function formatProgramUnitDetail(unit: ProgramItemUnitDetail): string {
  const title =
    unit.label?.trim()
    || unit.pieceFileTocEntryLabel?.trim()
    || unit.pieceFileTitle;

  if (unit.pieceFileTocEntryId && unit.pieceFileTocEntryLabel) {
    return title;
  }

  if (unit.navigationShortcutId && unit.navigationShortcutLabel) {
    return `${title} (${unit.navigationShortcutLabel})`;
  }

  const pages = formatPageRange(unit.startPage, unit.endPage);
  return pages ? `${title} (${pages})` : title;
}

export function formatProgramUnitsSummary(units: ProgramItemUnitDetail[]): string | null {
  if (units.length === 0) {
    return null;
  }
  return units.map(formatProgramUnitDetail).join(', ');
}
