export type PieceFileTocEntry = {
  id: string;
  organizationId: string;
  pieceFileId: string;
  label: string;
  sortOrder: number;
  targetPageNumber: number;
  targetX: number | null;
  targetY: number | null;
  endPageNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePieceFileTocEntryInput = {
  pieceFileId: string;
  label: string;
  sortOrder?: number;
  targetPageNumber: number;
  targetX?: number | null;
  targetY?: number | null;
  endPageNumber?: number | null;
};

export type UpdatePieceFileTocEntryInput = {
  label?: string;
  sortOrder?: number;
  targetPageNumber?: number;
  targetX?: number | null;
  targetY?: number | null;
  endPageNumber?: number | null;
};

export type ReorderPieceFileTocEntriesInput = {
  pieceFileId: string;
  orderedIds: string[];
};
