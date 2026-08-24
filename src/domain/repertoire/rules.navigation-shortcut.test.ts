import { describe, expect, it } from 'vitest';

import {
  validateCreatePdfNavigationShortcutInput,
  validateUpdatePdfNavigationShortcutInput,
} from './rules';

describe('navigation shortcut validation', () => {
  const baseInput = {
    pieceFileId: 'file-1',
    label: 'Segno',
    targetPageNumber: 3,
  };

  it('accepts a valid shortcut without anchor', () => {
    expect(validateCreatePdfNavigationShortcutInput(baseInput)).toBeNull();
  });

  it('rejects empty label', () => {
    expect(
      validateCreatePdfNavigationShortcutInput({ ...baseInput, label: '  ' }),
    ).toBe('invalid_label');
  });

  it('rejects invalid page number', () => {
    expect(
      validateCreatePdfNavigationShortcutInput({ ...baseInput, targetPageNumber: 0 }),
    ).toBe('invalid_page_number');
  });

  it('rejects partial anchor', () => {
    expect(
      validateCreatePdfNavigationShortcutInput({
        ...baseInput,
        anchorPageNumber: 2,
        anchorX: 0.5,
      }),
    ).toBe('invalid_anchor');
  });

  it('accepts complete anchor', () => {
    expect(
      validateCreatePdfNavigationShortcutInput({
        ...baseInput,
        anchorPageNumber: 2,
        anchorX: 0.5,
        anchorY: 0.3,
      }),
    ).toBeNull();
  });

  it('validates update against existing anchor state', () => {
    expect(
      validateUpdatePdfNavigationShortcutInput(
        { anchorX: 0.2 },
        {
          targetPageNumber: 3,
          targetY: null,
          anchorPageNumber: 2,
          anchorX: 0.5,
          anchorY: 0.3,
        },
      ),
    ).toBeNull();
  });
});
