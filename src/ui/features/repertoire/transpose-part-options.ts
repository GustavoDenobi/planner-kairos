import type { PieceFilePartLink } from '@/domain/repertoire';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import type { PdfViewerTransposePartOption } from '@/ui/features/repertoire/PdfViewerTranspositionModal';

export function mapTransposePartOptions(
  parts: PartWithDivisions[],
): PdfViewerTransposePartOption[] {
  return parts.map((part) => ({
    id: part.id,
    name: part.name,
    defaultTransposeSemitones: part.defaultTransposeSemitones,
  }));
}

export type FileDefaultTunerTranspose = {
  partId: string;
  semitones: number;
};

/** Transposição padrão quando o arquivo está ligado a uma única parte com tom configurado. */
export function inferDefaultTunerTransposeFromFilePartLinks(
  links: readonly PieceFilePartLink[],
  partOptions: readonly PdfViewerTransposePartOption[],
): FileDefaultTunerTranspose | null {
  if (links.length === 0 || partOptions.length === 0) {
    return null;
  }

  const uniquePartIds = [...new Set(links.map((link) => link.partId))];
  if (uniquePartIds.length !== 1) {
    return null;
  }

  const partId = uniquePartIds[0]!;
  const part = partOptions.find((option) => option.id === partId);
  if (!part || part.defaultTransposeSemitones === 0) {
    return null;
  }

  return { partId, semitones: part.defaultTransposeSemitones };
}
