export type PieceFileOrganization = 'distributed' | 'sequential' | 'single';

export const PIECE_FILE_ORGANIZATIONS: PieceFileOrganization[] = [
  'distributed',
  'sequential',
  'single',
];

export function isPieceFileOrganization(value: string): value is PieceFileOrganization {
  return PIECE_FILE_ORGANIZATIONS.includes(value as PieceFileOrganization);
}

export type PieceFileOrganizationHint = {
  hasPartLinkedScore: boolean;
  scoreFileCount: number;
};

export function inferPieceFileOrganization(hint: PieceFileOrganizationHint): PieceFileOrganization {
  if (hint.hasPartLinkedScore) {
    return 'distributed';
  }
  if (hint.scoreFileCount > 1) {
    return 'sequential';
  }
  return 'single';
}
