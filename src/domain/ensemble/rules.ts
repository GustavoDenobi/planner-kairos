import type { AssignmentInput } from './assignment';
import type { MusicianInput } from './musician';
import type { PartDivisionInput } from './part-division';
import type { PartInput } from './part';
import type { Section } from './section';
import type { SectionInput } from './section';

export function isValidMusicianName(fullName: string): boolean {
  return fullName.trim().length > 0;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidPhoneFormat(phone: string | null | undefined): boolean {
  if (!phone || phone.trim() === '') {
    return true;
  }
  const digits = normalizePhone(phone);
  return digits.length >= 10 && digits.length <= 11;
}

export function isValidEmailFormat(email: string | null | undefined): boolean {
  if (!email || email.trim() === '') {
    return true;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateMusicianInput(input: MusicianInput): string | null {
  if (!isValidMusicianName(input.fullName)) {
    return 'invalid_name';
  }
  if (!isValidPhoneFormat(input.phone)) {
    return 'invalid_phone';
  }
  if (!isValidEmailFormat(input.email)) {
    return 'invalid_email';
  }
  return null;
}

export function isValidPartName(name: string): boolean {
  return name.trim().length > 0;
}

export function isValidSortOrder(sortOrder: number): boolean {
  return Number.isInteger(sortOrder) && sortOrder >= 0;
}

export function validatePartInput(input: PartInput): string | null {
  if (!isValidPartName(input.name)) {
    return 'invalid_name';
  }
  if (input.sortOrder !== undefined && !isValidSortOrder(input.sortOrder)) {
    return 'invalid_sort_order';
  }
  return null;
}

export function validatePartDivisionInput(input: PartDivisionInput): string | null {
  if (!isValidPartName(input.name)) {
    return 'invalid_name';
  }
  if (input.sortOrder !== undefined && !isValidSortOrder(input.sortOrder)) {
    return 'invalid_sort_order';
  }
  return null;
}

export function validateSectionInput(input: SectionInput): string | null {
  if (!isValidPartName(input.name)) {
    return 'invalid_name';
  }
  if (input.sortOrder !== undefined && !isValidSortOrder(input.sortOrder)) {
    return 'invalid_sort_order';
  }
  return null;
}

export function validateAssignmentInput(
  input: AssignmentInput,
  section: Section | null,
  sectionPartIds: string[] | null = null,
): string | null {
  if (input.ensembleRole === 'section_lead' && !input.sectionId) {
    return 'section_lead_requires_section';
  }

  if (input.sectionId && section && section.groupId !== input.groupId) {
    return 'section_group_mismatch';
  }

  if (input.sectionId && input.partId && sectionPartIds !== null) {
    if (!sectionPartIds.includes(input.partId)) {
      return 'section_part_mismatch';
    }
  }

  return null;
}
