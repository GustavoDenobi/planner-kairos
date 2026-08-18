import type { PieceFileKind, PieceFilePartLink } from './piece-file';
import type { PieceCategoryInput } from './piece-category';
import type { PieceInput } from './piece';
import type { PieceThemeInput } from './piece-theme';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SCORE_MIMES = new Set(['application/pdf']);
const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav']);

export function slugifyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && SLUG_PATTERN.test(slug);
}

export function isValidTitle(title: string): boolean {
  return title.trim().length > 0;
}

export function isValidCategoryId(categoryId: string): boolean {
  return categoryId.trim().length > 0;
}

export const MAX_PIECE_ALIASES = 20;

export function normalizePieceAliases(aliases?: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of aliases ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_PIECE_ALIASES) {
      break;
    }
  }

  return result;
}

export function validatePieceInput(input: PieceInput): string | null {
  if (!isValidTitle(input.title)) {
    return 'invalid_title';
  }
  if (!isValidCategoryId(input.categoryId)) {
    return 'invalid_category';
  }
  return null;
}

export function validatePieceCategoryInput(input: PieceCategoryInput): string | null {
  if (!isValidTitle(input.name)) {
    return 'invalid_name';
  }
  const slug = input.slug ?? slugifyName(input.name);
  if (!isValidSlug(slug)) {
    return 'invalid_slug';
  }
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
    return 'invalid_sort_order';
  }
  return null;
}

export function validatePieceThemeInput(input: PieceThemeInput): string | null {
  if (!isValidTitle(input.name)) {
    return 'invalid_name';
  }
  const slug = input.slug ?? slugifyName(input.name);
  if (!isValidSlug(slug)) {
    return 'invalid_slug';
  }
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
    return 'invalid_sort_order';
  }
  return null;
}

export function mimeToPieceFileKind(mimeType: string): PieceFileKind | null {
  if (SCORE_MIMES.has(mimeType)) {
    return 'score';
  }
  if (AUDIO_MIMES.has(mimeType) || mimeType.startsWith('audio/')) {
    return 'audio';
  }
  return null;
}

export function validatePieceFileMime(mimeType: string): string | null {
  if (mimeToPieceFileKind(mimeType) === null) {
    return 'invalid_mime_type';
  }
  return null;
}

export function validatePieceFilePartLinks(
  links: PieceFilePartLink[],
  divisionPartIds: Map<string, string>,
): string | null {
  for (const link of links) {
    if (!link.partId.trim()) {
      return 'invalid_part_link';
    }
    if (link.partDivisionId) {
      const expectedPartId = divisionPartIds.get(link.partDivisionId);
      if (!expectedPartId || expectedPartId !== link.partId) {
        return 'division_part_mismatch';
      }
    }
  }
  return null;
}

export function defaultPieceFileTitle(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) {
    return fileName;
  }
  return fileName.slice(0, lastDot);
}

export function validatePieceFileTitle(title: string): string | null {
  if (!title.trim()) {
    return 'invalid_file_title';
  }
  return null;
}
