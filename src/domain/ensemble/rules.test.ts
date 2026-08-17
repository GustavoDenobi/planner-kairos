import { describe, expect, it } from 'vitest';
import type { AssignmentInput } from './assignment';
import type { Section } from './section';
import {
  isValidEmailFormat,
  isValidMusicianName,
  isValidPartName,
  isValidPhoneFormat,
  isValidSortOrder,
  normalizePhone,
  validateAssignmentInput,
  validateMusicianInput,
  validatePartDivisionInput,
  validatePartInput,
  validateSectionInput,
} from './rules';

describe('isValidMusicianName', () => {
  it('returns true for non-empty name', () => {
    expect(isValidMusicianName('Maria Silva')).toBe(true);
  });

  it('returns false for blank name', () => {
    expect(isValidMusicianName('   ')).toBe(false);
  });
});

describe('isValidPhoneFormat', () => {
  it('accepts empty phone', () => {
    expect(isValidPhoneFormat(null)).toBe(true);
    expect(isValidPhoneFormat('')).toBe(true);
  });

  it('accepts 10 or 11 digits with or without punctuation', () => {
    expect(isValidPhoneFormat('11987654321')).toBe(true);
    expect(isValidPhoneFormat('(11) 98765-4321')).toBe(true);
    expect(isValidPhoneFormat('1133334444')).toBe(true);
  });

  it('rejects invalid length', () => {
    expect(isValidPhoneFormat('123')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('strips non-digits', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('11987654321');
  });
});

describe('isValidEmailFormat', () => {
  it('accepts empty email', () => {
    expect(isValidEmailFormat(null)).toBe(true);
    expect(isValidEmailFormat('')).toBe(true);
  });

  it('accepts valid email', () => {
    expect(isValidEmailFormat('user@example.com')).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(isValidEmailFormat('not-an-email')).toBe(false);
  });
});

describe('validateMusicianInput', () => {
  it('returns null for valid input', () => {
    expect(validateMusicianInput({ fullName: 'João' })).toBeNull();
  });

  it('returns invalid_name for blank name', () => {
    expect(validateMusicianInput({ fullName: '  ' })).toBe('invalid_name');
  });

  it('returns invalid_phone for bad phone', () => {
    expect(validateMusicianInput({ fullName: 'João', phone: '123' })).toBe('invalid_phone');
  });

  it('returns invalid_email for bad email', () => {
    expect(validateMusicianInput({ fullName: 'João', email: 'bad' })).toBe('invalid_email');
  });
});

describe('validatePartInput', () => {
  it('returns null for valid part', () => {
    expect(
      validatePartInput({ name: 'Violino', kind: 'instrument', sortOrder: 0 }),
    ).toBeNull();
  });

  it('returns invalid_name for blank name', () => {
    expect(validatePartInput({ name: ' ', kind: 'instrument' })).toBe('invalid_name');
  });

  it('returns invalid_sort_order for negative sort', () => {
    expect(
      validatePartInput({ name: 'Violino', kind: 'instrument', sortOrder: -1 }),
    ).toBe('invalid_sort_order');
  });
});

describe('validatePartDivisionInput', () => {
  it('returns null for valid division', () => {
    expect(validatePartDivisionInput({ name: '1', sortOrder: 0 })).toBeNull();
  });

  it('returns invalid_name for blank name', () => {
    expect(validatePartDivisionInput({ name: '  ' })).toBe('invalid_name');
  });
});

describe('validateSectionInput', () => {
  it('returns null for valid section', () => {
    expect(validateSectionInput({ name: 'Cordas', sortOrder: 0 })).toBeNull();
  });

  it('returns invalid_name for blank name', () => {
    expect(validateSectionInput({ name: '' })).toBe('invalid_name');
  });
});

describe('isValidPartName and isValidSortOrder', () => {
  it('validates name and sort order', () => {
    expect(isValidPartName('Sax alto')).toBe(true);
    expect(isValidSortOrder(0)).toBe(true);
    expect(isValidSortOrder(-1)).toBe(false);
  });
});

describe('validateAssignmentInput', () => {
  const section: Section = {
    id: 'section-1',
    organizationId: 'org-1',
    groupId: 'group-1',
    name: 'Cordas',
    sortOrder: 0,
    notes: null,
  };

  const baseInput: AssignmentInput = {
    groupId: 'group-1',
    ensembleRole: 'member',
  };

  it('returns null for valid assignment', () => {
    expect(validateAssignmentInput(baseInput, null)).toBeNull();
  });

  it('requires section for section_lead', () => {
    expect(
      validateAssignmentInput({ ...baseInput, ensembleRole: 'section_lead' }, null),
    ).toBe('section_lead_requires_section');
  });

  it('rejects section from different group', () => {
    expect(
      validateAssignmentInput(
        { ...baseInput, groupId: 'group-2', sectionId: 'section-1' },
        section,
      ),
    ).toBe('section_group_mismatch');
  });

  it('rejects part not linked to section', () => {
    expect(
      validateAssignmentInput(
        { ...baseInput, sectionId: 'section-1', partId: 'part-trombone' },
        section,
        ['part-violin'],
      ),
    ).toBe('section_part_mismatch');
  });

  it('accepts part linked to section', () => {
    expect(
      validateAssignmentInput(
        { ...baseInput, sectionId: 'section-1', partId: 'part-violin' },
        section,
        ['part-violin', 'part-viola'],
      ),
    ).toBeNull();
  });

  it('allows part without section', () => {
    expect(
      validateAssignmentInput(
        { ...baseInput, partId: 'part-trombone' },
        null,
        null,
      ),
    ).toBeNull();
  });
});
