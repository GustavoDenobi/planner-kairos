import { describe, expect, it } from 'vitest';
import {
  defaultPieceFileTitle,
  mimeToPieceFileKind,
  normalizePieceAliases,
  slugifyName,
  validatePieceCategoryInput,
  validatePieceFileMime,
  validatePieceFilePartLinks,
  validatePieceFileTitle,
  validatePieceInput,
  validatePieceThemeInput,
} from './rules';

describe('normalizePieceAliases', () => {
  it('trims, removes empty entries, and deduplicates case-insensitively', () => {
    expect(
      normalizePieceAliases(['  Solo da guita  ', '', 'solo da guita', 'Quinta música']),
    ).toEqual(['Solo da guita', 'Quinta música']);
  });

  it('limits the number of aliases', () => {
    const many = Array.from({ length: 25 }, (_, index) => `Alias ${index}`);
    expect(normalizePieceAliases(many).length).toBe(20);
  });

  it('returns empty array for undefined input', () => {
    expect(normalizePieceAliases()).toEqual([]);
  });
});

describe('validatePieceInput', () => {
  it('rejects empty title', () => {
    expect(validatePieceInput({ title: '  ', categoryId: 'cat-1' })).toBe('invalid_title');
  });

  it('rejects missing category', () => {
    expect(validatePieceInput({ title: 'Obra', categoryId: '' })).toBe('invalid_category');
  });

  it('accepts valid input', () => {
    expect(validatePieceInput({ title: 'Obra', categoryId: 'cat-1' })).toBeNull();
  });
});

describe('validatePieceCategoryInput', () => {
  it('generates slug from name', () => {
    expect(validatePieceCategoryInput({ name: 'HCA' })).toBeNull();
  });

  it('rejects invalid slug', () => {
    expect(validatePieceCategoryInput({ name: 'X', slug: 'Bad Slug' })).toBe('invalid_slug');
  });
});

describe('validatePieceThemeInput', () => {
  it('accepts accented name with generated slug', () => {
    expect(validatePieceCategoryInput({ name: 'Páscoa' })).toBeNull();
    expect(slugifyName('Páscoa')).toBe('pascoa');
  });

  it('rejects invalid sort order', () => {
    expect(validatePieceThemeInput({ name: 'Natal', sortOrder: -1 })).toBe('invalid_sort_order');
  });
});

describe('mimeToPieceFileKind', () => {
  it('maps pdf to score', () => {
    expect(mimeToPieceFileKind('application/pdf')).toBe('score');
  });

  it('maps audio mimes', () => {
    expect(mimeToPieceFileKind('audio/mpeg')).toBe('audio');
    expect(mimeToPieceFileKind('audio/wav')).toBe('audio');
  });

  it('rejects unknown mime', () => {
    expect(mimeToPieceFileKind('image/png')).toBeNull();
    expect(validatePieceFileMime('image/png')).toBe('invalid_mime_type');
  });
});

describe('validatePieceFilePartLinks', () => {
  const divisionPartIds = new Map([
    ['div-1', 'part-trombone'],
    ['div-2', 'part-trombone'],
  ]);

  it('accepts link without division', () => {
    expect(
      validatePieceFilePartLinks([{ partId: 'part-sax', partDivisionId: null }], divisionPartIds),
    ).toBeNull();
  });

  it('rejects division that does not belong to part', () => {
    expect(
      validatePieceFilePartLinks(
        [{ partId: 'part-sax', partDivisionId: 'div-1' }],
        divisionPartIds,
      ),
    ).toBe('division_part_mismatch');
  });

  it('accepts matching division and part', () => {
    expect(
      validatePieceFilePartLinks(
        [{ partId: 'part-trombone', partDivisionId: 'div-1' }],
        divisionPartIds,
      ),
    ).toBeNull();
  });
});

describe('defaultPieceFileTitle', () => {
  it('removes the last extension', () => {
    expect(defaultPieceFileTitle('partitura.pdf')).toBe('partitura');
    expect(defaultPieceFileTitle('audio.track.mp3')).toBe('audio.track');
  });

  it('keeps names without extension', () => {
    expect(defaultPieceFileTitle('partitura')).toBe('partitura');
  });
});

describe('validatePieceFileTitle', () => {
  it('rejects empty titles', () => {
    expect(validatePieceFileTitle('')).toBe('invalid_file_title');
    expect(validatePieceFileTitle('   ')).toBe('invalid_file_title');
  });

  it('accepts non-empty titles', () => {
    expect(validatePieceFileTitle('Violino 1')).toBeNull();
  });
});
