export type PdfNavigationShortcut = {
  id: string;
  organizationId: string;
  pieceFileId: string;
  label: string;
  color: string;
  sortOrder: number;
  targetPageNumber: number;
  targetX: number | null;
  targetY: number | null;
  anchorPageNumber: number | null;
  anchorX: number | null;
  anchorY: number | null;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePdfNavigationShortcutInput = {
  pieceFileId: string;
  label: string;
  color?: string;
  sortOrder?: number;
  targetPageNumber: number;
  targetX?: number | null;
  targetY?: number | null;
  anchorPageNumber?: number | null;
  anchorX?: number | null;
  anchorY?: number | null;
};

export type UpdatePdfNavigationShortcutInput = {
  label?: string;
  color?: string;
  sortOrder?: number;
  targetPageNumber?: number;
  targetX?: number | null;
  targetY?: number | null;
  anchorPageNumber?: number | null;
  anchorX?: number | null;
  anchorY?: number | null;
};

export type ReorderPdfNavigationShortcutsInput = {
  pieceFileId: string;
  orderedIds: string[];
};
