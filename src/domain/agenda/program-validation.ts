import type { PieceDetail } from '@/domain/repertoire/piece';
import type { PieceFileTocEntry } from '@/domain/repertoire/piece-file-toc-entry';
import type {
  ProgramItemValidationContext,
  ProgramItemValidationPiece,
} from './program-item';

export function buildProgramItemValidationContext(
  pieces: PieceDetail[],
  tocEntriesByPieceId?: Map<string, PieceFileTocEntry[]>,
): ProgramItemValidationContext {
  const piecesById = new Map<string, ProgramItemValidationPiece>();

  for (const piece of pieces) {
    const tocEntries = tocEntriesByPieceId?.get(piece.id) ?? [];
    const tocByFileId = new Map<string, Set<string>>();
    for (const entry of tocEntries) {
      const set = tocByFileId.get(entry.pieceFileId) ?? new Set<string>();
      set.add(entry.id);
      tocByFileId.set(entry.pieceFileId, set);
    }

    piecesById.set(piece.id, {
      fileOrganization: piece.fileOrganization,
      files: piece.files.map((file) => ({
        id: file.id,
        kind: file.kind,
        partLinkCount: file.partLinks.length,
        tocEntryIds: tocByFileId.get(file.id) ?? new Set<string>(),
      })),
    });
  }

  return { piecesById };
}
