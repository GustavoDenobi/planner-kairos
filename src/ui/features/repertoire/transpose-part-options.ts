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
