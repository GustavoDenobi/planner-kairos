import type {
  CreatePdfNavigationShortcutInput,
  PdfNavigationShortcut,
  UpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';

export type PieceFileNavigationShortcutRepository = {
  listForFile(organizationId: string, pieceFileId: string): Promise<PdfNavigationShortcut[]>;
  create(
    organizationId: string,
    authorUserId: string,
    input: CreatePdfNavigationShortcutInput,
  ): Promise<PdfNavigationShortcut>;
  update(
    organizationId: string,
    pieceFileId: string,
    shortcutId: string,
    input: UpdatePdfNavigationShortcutInput,
  ): Promise<PdfNavigationShortcut | null>;
  remove(organizationId: string, pieceFileId: string, shortcutId: string): Promise<boolean>;
  reorder(
    organizationId: string,
    pieceFileId: string,
    orderedIds: string[],
  ): Promise<PdfNavigationShortcut[]>;
};
