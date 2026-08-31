import type {
  CreatePieceFileTocEntryInput,
  PieceFileTocEntry,
  UpdatePieceFileTocEntryInput,
} from '@/domain/repertoire';

export type PieceFileTocEntryRepository = {
  listForFile(organizationId: string, pieceFileId: string): Promise<PieceFileTocEntry[]>;
  listForPiece(organizationId: string, pieceId: string): Promise<PieceFileTocEntry[]>;
  create(
    organizationId: string,
    input: CreatePieceFileTocEntryInput,
  ): Promise<PieceFileTocEntry>;
  update(
    organizationId: string,
    pieceFileId: string,
    entryId: string,
    input: UpdatePieceFileTocEntryInput,
  ): Promise<PieceFileTocEntry | null>;
  remove(organizationId: string, pieceFileId: string, entryId: string): Promise<boolean>;
  reorder(
    organizationId: string,
    pieceFileId: string,
    orderedIds: string[],
  ): Promise<PieceFileTocEntry[]>;
};
