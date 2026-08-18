export type PieceFileKind = 'score' | 'audio';

export type PieceFilePartLink = {
  partId: string;
  partDivisionId: string | null;
};

export type PieceFile = {
  id: string;
  organizationId: string;
  pieceId: string;
  kind: PieceFileKind;
  storageKey: string;
  mimeType: string;
  title: string;
  originalName: string;
  byteSize: number | null;
  contentHash: string | null;
};

export type PieceFileWithLinks = PieceFile & {
  partLinks: PieceFilePartLink[];
};
