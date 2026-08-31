import { describe, expect, it } from 'vitest';
import {
  validateCreatePieceFileTocEntryInput,
  validateUpdatePieceFileTocEntryInput,
} from './rules';

describe('validateCreatePieceFileTocEntryInput', () => {
  const baseInput = {
    pieceFileId: 'file-1',
    label: 'Lição 1',
    targetPageNumber: 2,
  };

  it('accepts valid input', () => {
    expect(validateCreatePieceFileTocEntryInput(baseInput)).toBeNull();
  });

  it('rejects empty label', () => {
    expect(validateCreatePieceFileTocEntryInput({ ...baseInput, label: '  ' })).toBe(
      'invalid_label',
    );
  });

  it('rejects invalid page numbers', () => {
    expect(
      validateCreatePieceFileTocEntryInput({ ...baseInput, targetPageNumber: 0 }),
    ).toBe('invalid_page_number');
  });

  it('accepts optional normalized coordinates', () => {
    expect(
      validateCreatePieceFileTocEntryInput({
        ...baseInput,
        targetX: 0.25,
        targetY: 0.4,
      }),
    ).toBeNull();
  });

  it('rejects invalid coordinates', () => {
    expect(
      validateCreatePieceFileTocEntryInput({
        ...baseInput,
        targetY: 1.5,
      }),
    ).toBe('invalid_coordinates');
  });
});

describe('validateUpdatePieceFileTocEntryInput', () => {
  it('validates end page against existing target page', () => {
    expect(
      validateUpdatePieceFileTocEntryInput({ endPageNumber: 1 }, { targetPageNumber: 3 }),
    ).toBe('invalid_page_range');
  });
});
