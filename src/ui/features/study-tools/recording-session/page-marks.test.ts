import { describe, expect, it } from 'vitest';
import { appendStudyRecordingPageMark } from '@/ui/features/study-tools/recording-session/page-marks';

const FILE_A = 'file-a';
const FILE_B = 'file-b';

describe('appendStudyRecordingPageMark', () => {
  it('acrescenta a primeira marca', () => {
    expect(appendStudyRecordingPageMark([], { atSec: 0, pieceFileId: FILE_A, page: 1 })).toEqual([
      { atSec: 0, pieceFileId: FILE_A, page: 1 },
    ]);
  });

  it('ignora a mesma página repetida', () => {
    const marks = [{ atSec: 0, pieceFileId: FILE_A, page: 1 }];
    expect(appendStudyRecordingPageMark(marks, { atSec: 5, pieceFileId: FILE_A, page: 1 })).toEqual(
      marks,
    );
  });

  it('registra troca de página e de arquivo', () => {
    let marks = appendStudyRecordingPageMark([], { atSec: 0, pieceFileId: FILE_A, page: 1 });
    marks = appendStudyRecordingPageMark(marks, { atSec: 12.4, pieceFileId: FILE_A, page: 2 });
    marks = appendStudyRecordingPageMark(marks, { atSec: 30, pieceFileId: FILE_B, page: 2 });
    expect(marks).toEqual([
      { atSec: 0, pieceFileId: FILE_A, page: 1 },
      { atSec: 12.4, pieceFileId: FILE_A, page: 2 },
      { atSec: 30, pieceFileId: FILE_B, page: 2 },
    ]);
  });

  it('no mesmo instante, substitui a última marca', () => {
    const marks = [
      { atSec: 0, pieceFileId: FILE_A, page: 1 },
      { atSec: 10, pieceFileId: FILE_A, page: 2 },
    ];
    expect(appendStudyRecordingPageMark(marks, { atSec: 10, pieceFileId: FILE_A, page: 3 })).toEqual([
      { atSec: 0, pieceFileId: FILE_A, page: 1 },
      { atSec: 10, pieceFileId: FILE_A, page: 3 },
    ]);
  });

  it('no mesmo instante, voltar à página anterior desfaz a marca', () => {
    const marks = [
      { atSec: 0, pieceFileId: FILE_A, page: 1 },
      { atSec: 10, pieceFileId: FILE_A, page: 2 },
    ];
    expect(appendStudyRecordingPageMark(marks, { atSec: 10, pieceFileId: FILE_A, page: 1 })).toEqual([
      { atSec: 0, pieceFileId: FILE_A, page: 1 },
    ]);
  });
});
