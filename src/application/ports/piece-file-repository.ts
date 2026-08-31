import type { PieceFileKind, PieceFilePartLink, PieceFileWithLinks } from '@/domain/repertoire';

export type CreatePieceFileInput = {
  id: string;
  pieceId: string;
  kind: PieceFileKind;
  storageKey: string;
  mimeType: string;
  title: string;
  originalName: string;
  byteSize: number | null;
  contentHash: string;
  partLinks: PieceFilePartLink[];
  sortOrder?: number;
};

export type UpdatePieceFileInput = {
  title: string;
  partLinks?: PieceFilePartLink[];
  sortOrder?: number;
};

export type PieceFileRepository = {
  listForPiece(organizationId: string, pieceId: string): Promise<PieceFileWithLinks[]>;
  getById(
    organizationId: string,
    pieceId: string,
    fileId: string,
  ): Promise<PieceFileWithLinks | null>;
  getByFileId(organizationId: string, fileId: string): Promise<PieceFileWithLinks | null>;
  findByContentHash(
    organizationId: string,
    pieceId: string,
    contentHash: string,
  ): Promise<PieceFileWithLinks | null>;
  create(organizationId: string, input: CreatePieceFileInput): Promise<PieceFileWithLinks>;
  update(
    organizationId: string,
    pieceId: string,
    fileId: string,
    input: UpdatePieceFileInput,
  ): Promise<PieceFileWithLinks | null>;
  reorderScores(
    organizationId: string,
    pieceId: string,
    orderedFileIds: string[],
  ): Promise<PieceFileWithLinks[]>;
  remove(organizationId: string, pieceId: string, fileId: string): Promise<PieceFileWithLinks | null>;
};
