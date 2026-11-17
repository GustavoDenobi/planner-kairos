import type { StudyRecordingPageMark } from '@/infrastructure/pwa/db';

/**
 * Acrescenta uma marca de página à linha do tempo da gravação.
 * Ignora repetições da página atual e, se duas marcas caírem no mesmo instante
 * (navegação rápida), mantém só a última.
 */
export function appendStudyRecordingPageMark(
  marks: readonly StudyRecordingPageMark[],
  mark: StudyRecordingPageMark,
): StudyRecordingPageMark[] {
  const last = marks.at(-1);
  if (last && last.pieceFileId === mark.pieceFileId && last.page === mark.page) {
    return [...marks];
  }
  if (last && mark.atSec <= last.atSec) {
    const previous = marks.at(-2);
    const withoutLast = marks.slice(0, -1);
    if (previous && previous.pieceFileId === mark.pieceFileId && previous.page === mark.page) {
      return withoutLast;
    }
    return [...withoutLast, { ...mark, atSec: last.atSec }];
  }
  return [...marks, mark];
}
