import type { PieceFileOrganization } from '@/domain/repertoire/piece-file-organization';

export type ProgramItemStatus = 'planned' | 'performed' | 'skipped';

export type ProgramItemUnit = {
  id: string;
  pieceFileId: string;
  sortOrder: number;
  startPage: number | null;
  endPage: number | null;
  navigationShortcutId: string | null;
  pieceFileTocEntryId: string | null;
  label: string | null;
};

export type ProgramItemUnitInput = {
  pieceFileId: string;
  sortOrder?: number;
  startPage?: number | null;
  endPage?: number | null;
  navigationShortcutId?: string | null;
  pieceFileTocEntryId?: string | null;
  label?: string | null;
};

export type ProgramItemUnitDetail = ProgramItemUnit & {
  pieceFileTitle: string;
  navigationShortcutLabel: string | null;
  navigationShortcutTargetPage: number | null;
  pieceFileTocEntryLabel: string | null;
  pieceFileTocEntryTargetPage: number | null;
  pieceFileTocEntryEndPage: number | null;
};

export type ProgramItem = {
  id: string;
  organizationId: string;
  eventId: string;
  pieceId: string;
  sortOrder: number;
  notes: string | null;
  status: ProgramItemStatus;
};

export type ProgramItemInput = {
  pieceId: string;
  notes?: string | null;
  status?: ProgramItemStatus;
  units?: ProgramItemUnitInput[];
};

export type ProgramItemDetail = ProgramItem & {
  pieceTitle: string;
  pieceDeleted: boolean;
  pieceCategory: {
    name: string;
    slug: string;
    color: string | null;
  } | null;
  fileOrganization: PieceFileOrganization;
  units: ProgramItemUnitDetail[];
};

export type ProgramItemValidationFile = {
  id: string;
  kind: 'score' | 'audio';
  partLinkCount: number;
  tocEntryIds: Set<string>;
};

export type ProgramItemValidationPiece = {
  fileOrganization: PieceFileOrganization;
  files: ProgramItemValidationFile[];
};

export type ProgramItemValidationContext = {
  piecesById: Map<string, ProgramItemValidationPiece>;
};

export function resolveProgramUnitStartPage(unit: Pick<
  ProgramItemUnitDetail,
  | 'startPage'
  | 'navigationShortcutId'
  | 'navigationShortcutTargetPage'
  | 'pieceFileTocEntryId'
  | 'pieceFileTocEntryTargetPage'
>): number | null {
  if (unit.pieceFileTocEntryId && unit.pieceFileTocEntryTargetPage != null) {
    return unit.pieceFileTocEntryTargetPage;
  }
  if (unit.navigationShortcutId && unit.navigationShortcutTargetPage != null) {
    return unit.navigationShortcutTargetPage;
  }
  return unit.startPage;
}

export function resolveProgramUnitEndPage(unit: Pick<
  ProgramItemUnitDetail,
  'endPage' | 'pieceFileTocEntryId' | 'pieceFileTocEntryEndPage'
>): number | null {
  if (unit.endPage != null) {
    return unit.endPage;
  }
  if (unit.pieceFileTocEntryId && unit.pieceFileTocEntryEndPage != null) {
    return unit.pieceFileTocEntryEndPage;
  }
  return null;
}
