import { describe, expect, it } from 'vitest';
import { findEventsWithSamePieceEntry, programUnitsSignature } from './piece-program-duplicates';

const fileA = { pieceFileId: 'file-a' };
const fileAPages = { pieceFileId: 'file-a', startPage: 2, endPage: 4 };
const fileBToc = { pieceFileId: 'file-b', pieceFileTocEntryId: 'toc-1' };

describe('programUnitsSignature', () => {
  it('ignora a ordem dos trechos', () => {
    expect(programUnitsSignature([fileA, fileBToc])).toBe(programUnitsSignature([fileBToc, fileA]));
  });

  it('trata null e undefined como iguais', () => {
    expect(
      programUnitsSignature([{ pieceFileId: 'file-a', startPage: null, endPage: null }]),
    ).toBe(programUnitsSignature([fileA]));
  });
});

describe('findEventsWithSamePieceEntry', () => {
  const entries = [
    { eventId: 'whole', units: [] },
    { eventId: 'pages', units: [fileAPages] },
    { eventId: 'two', units: [fileA, fileBToc] },
  ];

  it('obra inteira só casa com obra inteira', () => {
    expect([...findEventsWithSamePieceEntry(entries, [])]).toEqual(['whole']);
  });

  it('mesmo trecho casa', () => {
    expect([...findEventsWithSamePieceEntry(entries, [fileAPages])]).toEqual(['pages']);
  });

  it('trecho diferente não casa', () => {
    expect(findEventsWithSamePieceEntry(entries, [{ pieceFileId: 'file-a', startPage: 5 }]).size).toBe(
      0,
    );
  });

  it('mesmo conjunto de trechos em outra ordem casa', () => {
    expect([...findEventsWithSamePieceEntry(entries, [fileBToc, fileA])]).toEqual(['two']);
  });

  it('subconjunto de trechos não casa', () => {
    expect(findEventsWithSamePieceEntry(entries, [fileA]).size).toBe(0);
  });

  it('arquivo completo equivale à obra inteira em obras não sequenciais', () => {
    const withFull = [{ eventId: 'full', units: [fileA] }];
    expect([...findEventsWithSamePieceEntry(withFull, [], { fullFileIsWholePiece: true })]).toEqual([
      'full',
    ]);
    expect(
      [...findEventsWithSamePieceEntry([{ eventId: 'whole', units: [] }], [{ pieceFileId: 'file-b' }], {
        fullFileIsWholePiece: true,
      })],
    ).toEqual(['whole']);
  });

  it('em obras sequenciais, arquivo completo não equivale à obra inteira', () => {
    const withFull = [{ eventId: 'full', units: [fileA] }];
    expect(findEventsWithSamePieceEntry(withFull, []).size).toBe(0);
  });
});
