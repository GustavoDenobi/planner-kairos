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

export function formatProgramUnitSegment(unit: ProgramItemUnitDetail): string | null {
  if (unit.pieceFileTocEntryId) {
    const name = unit.pieceFileTocEntryLabel?.trim() || unit.label?.trim() || null;
    if (!name) {
      return null;
    }
    const pages = formatPageRange(
      unit.pieceFileTocEntryTargetPage,
      unit.pieceFileTocEntryEndPage,
    );
    return pages ? `${name} (${pages})` : name;
  }

  if (unit.navigationShortcutId && unit.navigationShortcutLabel?.trim()) {
    return unit.navigationShortcutLabel.trim();
  }

  const pages = formatPageRange(unit.startPage, unit.endPage);
  const custom = unit.label?.trim() || null;
  if (custom && pages) {
    return `${custom} (${pages})`;
  }
  return pages ?? custom;
}
