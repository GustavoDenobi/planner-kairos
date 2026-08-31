import type {
  AnnotationGeometry,
  AnnotationLayer,
  AnnotationType,
  CreatePdfAnnotationInput,
  StrokeGeometry,
} from './piece-file-annotation';
import type { PieceFileKind, PieceFilePartLink, PieceFileWithLinks } from './piece-file';
import type { PieceCategoryInput } from './piece-category';
import type { PieceInput } from './piece';
import type { PieceThemeInput } from './piece-theme';
import type {
  CreatePdfNavigationShortcutInput,
  PdfNavigationShortcut,
  UpdatePdfNavigationShortcutInput,
} from './piece-file-navigation-shortcut';
import type {
  CreatePieceFileTocEntryInput,
  PieceFileTocEntry,
  UpdatePieceFileTocEntryInput,
} from './piece-file-toc-entry';
import type {
  CreateReadingPlaylistInput,
  UpdateReadingPlaylistInput,
} from './reading-playlist';
import { validateEventAudienceForGroupWriter } from '@/domain/agenda/rules';
import type { CreateAnnotationSetInput, UpdateAnnotationSetInput } from './annotation-set';
import { annotationSetHasAudience } from './annotation-set';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SCORE_MIMES = new Set(['application/pdf']);
const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav']);

const PIECE_FILE_EXTENSION_MIMES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

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

function pieceFileExtension(fileName: string): string | null {
  const match = fileName.trim().toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? null;
}

/** Resolves MIME from File.type or, when empty/unreliable, from the file extension. */
export function resolvePieceFileMime(file: Pick<File, 'name' | 'type'>): string | null {
  const fromType = file.type.trim();
  if (fromType && validatePieceFileMime(fromType) === null) {
    return fromType;
  }

  const extension = pieceFileExtension(file.name);
  if (extension) {
    const fromExtension = PIECE_FILE_EXTENSION_MIMES[extension];
    if (fromExtension && validatePieceFileMime(fromExtension) === null) {
      return fromExtension;
    }
  }

  return null;
}

export function isPieceFileScore(file: Pick<File, 'name' | 'type'>): boolean {
  const mime = resolvePieceFileMime(file);
  return mime !== null && mimeToPieceFileKind(mime) === 'score';
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

function isNormalizedCoord(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isStrokeGeometry(geometry: AnnotationGeometry): geometry is StrokeGeometry {
  return 'points' in geometry;
}

export function validateAnnotationGeometry(
  type: AnnotationType,
  geometry: AnnotationGeometry,
): string | null {
  if (type === 'stroke' || type === 'highlight') {
    if (!isStrokeGeometry(geometry)) {
      return 'invalid_geometry';
    }
    if (geometry.points.length < 2) {
      return 'invalid_stroke_points';
    }
    if (!Number.isFinite(geometry.strokeWidth) || geometry.strokeWidth <= 0) {
      return 'invalid_stroke_width';
    }
    for (const point of geometry.points) {
      if (!isNormalizedCoord(point.x) || !isNormalizedCoord(point.y)) {
        return 'invalid_coordinates';
      }
    }
    return null;
  }

  return 'invalid_geometry';
}

export function validateCreatePdfAnnotationInput(input: CreatePdfAnnotationInput): string | null {
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1) {
    return 'invalid_page_number';
  }
  if (!input.pieceFileId.trim()) {
    return 'invalid_piece_file';
  }
  if (!input.color.trim()) {
    return 'invalid_color';
  }

  const layerError = validateAnnotationLayer(input.layer, {
    sectionId: input.sectionId ?? null,
    annotationSetId: input.annotationSetId ?? null,
  });
  if (layerError) {
    return layerError;
  }

  return validateAnnotationGeometry(input.type, input.geometry);
}

export type AnnotationLayerRefs = {
  sectionId: string | null;
  annotationSetId: string | null;
};

export function validateAnnotationLayer(
  layer: AnnotationLayer,
  refs: AnnotationLayerRefs | string | null,
): string | null {
  const sectionId = typeof refs === 'object' && refs !== null && 'sectionId' in refs
    ? refs.sectionId
    : (refs as string | null);
  const annotationSetId = typeof refs === 'object' && refs !== null && 'annotationSetId' in refs
    ? refs.annotationSetId
    : null;

  if (layer === 'personal') {
    if (sectionId !== null) {
      return 'personal_layer_requires_no_section';
    }
    if (annotationSetId !== null) {
      return 'personal_layer_requires_no_set';
    }
    return null;
  }

  if (layer === 'section') {
    if (!sectionId?.trim()) {
      return 'section_layer_requires_section';
    }
    if (annotationSetId !== null) {
      return 'section_layer_requires_no_set';
    }
    return null;
  }

  if (layer === 'directed') {
    if (sectionId !== null) {
      return 'directed_layer_requires_no_section';
    }
    if (!annotationSetId?.trim()) {
      return 'directed_layer_requires_set';
    }
    return null;
  }

  return null;
}

export function validateDirectedAnnotationAudience(input: {
  groupIds: string[];
  musicianIds: string[];
  writableGroupIds: string[];
  musicianGroupIdsByMusicianId: Record<string, string[]>;
  creatorMusicianId: string | null;
}): string | null {
  if (!annotationSetHasAudience(input)) {
    return 'audience_required';
  }

  return validateEventAudienceForGroupWriter(input);
}

export function validateCreateAnnotationSetInput(input: CreateAnnotationSetInput): string | null {
  if (!input.pieceFileId.trim()) {
    return 'invalid_piece_file';
  }

  if (!annotationSetHasAudience(input)) {
    return 'audience_required';
  }

  return null;
}

export function validateUpdateAnnotationSetInput(input: UpdateAnnotationSetInput): string | null {
  if (input.groupIds !== undefined || input.musicianIds !== undefined) {
    const groupIds = input.groupIds ?? [];
    const musicianIds = input.musicianIds ?? [];
    if (!annotationSetHasAudience({ groupIds, musicianIds })) {
      return 'audience_required';
    }
  }

  return null;
}

function validateOptionalNormalizedCoord(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isNormalizedCoord(value)) {
    return 'invalid_coordinates';
  }
  return null;
}

function validateNavigationShortcutAnchor(
  anchorPageNumber: number | null | undefined,
  anchorX: number | null | undefined,
  anchorY: number | null | undefined,
): string | null {
  const hasPage = anchorPageNumber != null;
  const hasX = anchorX != null;
  const hasY = anchorY != null;

  if (!hasPage && !hasX && !hasY) {
    return null;
  }

  if (!hasPage || !hasX || !hasY) {
    return 'invalid_anchor';
  }

  if (!Number.isInteger(anchorPageNumber) || anchorPageNumber < 1) {
    return 'invalid_page_number';
  }

  const xError = validateOptionalNormalizedCoord(anchorX);
  if (xError) {
    return xError;
  }

  const yError = validateOptionalNormalizedCoord(anchorY);
  if (yError) {
    return yError;
  }

  return null;
}

export function validateCreatePdfNavigationShortcutInput(
  input: CreatePdfNavigationShortcutInput,
): string | null {
  if (!input.pieceFileId.trim()) {
    return 'invalid_piece_file';
  }
  if (!input.label.trim()) {
    return 'invalid_label';
  }
  if (!Number.isInteger(input.targetPageNumber) || input.targetPageNumber < 1) {
    return 'invalid_page_number';
  }
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
    return 'invalid_sort_order';
  }
  if (input.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(input.color)) {
    return 'invalid_color';
  }

  const targetXError = validateOptionalNormalizedCoord(input.targetX);
  if (targetXError) {
    return targetXError;
  }

  const targetYError = validateOptionalNormalizedCoord(input.targetY);
  if (targetYError) {
    return targetYError;
  }

  return validateNavigationShortcutAnchor(
    input.anchorPageNumber,
    input.anchorX,
    input.anchorY,
  );
}

export function validateUpdatePdfNavigationShortcutInput(
  input: UpdatePdfNavigationShortcutInput,
  existing: Pick<
    PdfNavigationShortcut,
    'targetPageNumber' | 'targetX' | 'targetY' | 'anchorPageNumber' | 'anchorX' | 'anchorY'
  >,
): string | null {
  if (input.label !== undefined && !input.label.trim()) {
    return 'invalid_label';
  }
  if (input.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(input.color)) {
    return 'invalid_color';
  }
  if (
    input.targetPageNumber !== undefined
    && (!Number.isInteger(input.targetPageNumber) || input.targetPageNumber < 1)
  ) {
    return 'invalid_page_number';
  }
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
    return 'invalid_sort_order';
  }

  const targetXError = validateOptionalNormalizedCoord(input.targetX);
  if (targetXError) {
    return targetXError;
  }

  const targetYError = validateOptionalNormalizedCoord(input.targetY);
  if (targetYError) {
    return targetYError;
  }

  return validateNavigationShortcutAnchor(
    input.anchorPageNumber ?? existing.anchorPageNumber,
    input.anchorX ?? existing.anchorX,
    input.anchorY ?? existing.anchorY,
  );
}

function validateOptionalEndPage(
  targetPageNumber: number,
  endPageNumber: number | null | undefined,
): string | null {
  if (endPageNumber == null) {
    return null;
  }
  if (!Number.isInteger(endPageNumber) || endPageNumber < 1) {
    return 'invalid_end_page';
  }
  if (endPageNumber < targetPageNumber) {
    return 'invalid_page_range';
  }
  return null;
}

export function validateCreatePieceFileTocEntryInput(
  input: CreatePieceFileTocEntryInput,
): string | null {
  if (!input.pieceFileId.trim()) {
    return 'invalid_piece_file';
  }
  if (!input.label.trim()) {
    return 'invalid_label';
  }
  if (!Number.isInteger(input.targetPageNumber) || input.targetPageNumber < 1) {
    return 'invalid_page_number';
  }
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
    return 'invalid_sort_order';
  }

  const targetXError = validateOptionalNormalizedCoord(input.targetX);
  if (targetXError) {
    return targetXError;
  }

  const targetYError = validateOptionalNormalizedCoord(input.targetY);
  if (targetYError) {
    return targetYError;
  }

  return validateOptionalEndPage(input.targetPageNumber, input.endPageNumber);
}

export function validateUpdatePieceFileTocEntryInput(
  input: UpdatePieceFileTocEntryInput,
  existing: Pick<PieceFileTocEntry, 'targetPageNumber'>,
): string | null {
  if (input.label !== undefined && !input.label.trim()) {
    return 'invalid_label';
  }
  if (
    input.targetPageNumber !== undefined
    && (!Number.isInteger(input.targetPageNumber) || input.targetPageNumber < 1)
  ) {
    return 'invalid_page_number';
  }
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
    return 'invalid_sort_order';
  }

  const targetXError = validateOptionalNormalizedCoord(input.targetX);
  if (targetXError) {
    return targetXError;
  }

  const targetYError = validateOptionalNormalizedCoord(input.targetY);
  if (targetYError) {
    return targetYError;
  }

  const targetPage = input.targetPageNumber ?? existing.targetPageNumber;
  return validateOptionalEndPage(targetPage, input.endPageNumber);
}

export function pieceFileMatchesUserParts(
  file: Pick<PieceFileWithLinks, 'partLinks'>,
  userPartIds: string[],
): boolean {
  if (userPartIds.length === 0) {
    return false;
  }
  if (file.partLinks.length === 0) {
    return true;
  }
  return file.partLinks.some((link) => userPartIds.includes(link.partId));
}

export function isGeneralPieceFile(
  file: Pick<PieceFileWithLinks, 'partLinks'>,
): boolean {
  return file.partLinks.length === 0;
}

export function isGeneralScoreFile(
  file: Pick<PieceFileWithLinks, 'kind' | 'partLinks'>,
): boolean {
  return file.kind === 'score' && isGeneralPieceFile(file);
}

export function partitionPieceFilesForViewer(
  files: PieceFileWithLinks[],
  userPartIds: string[],
  isConductor: boolean,
): {
  userFiles: PieceFileWithLinks[];
  generalFiles: PieceFileWithLinks[];
  audioFiles: PieceFileWithLinks[];
  otherFiles: PieceFileWithLinks[];
} {
  const generalFiles = isConductor ? files.filter((file) => isGeneralScoreFile(file)) : [];
  const generalIds = new Set(generalFiles.map((file) => file.id));

  const userFiles =
    userPartIds.length > 0
      ? files.filter(
          (file) =>
            file.kind === 'score' &&
            !generalIds.has(file.id) &&
            pieceFileMatchesUserParts(file, userPartIds),
        )
      : [];
  const userIds = new Set(userFiles.map((file) => file.id));

  const audioFiles = files.filter((file) => file.kind === 'audio');
  const audioIds = new Set(audioFiles.map((file) => file.id));

  const otherFiles = files.filter(
    (file) =>
      !generalIds.has(file.id) && !userIds.has(file.id) && !audioIds.has(file.id),
  );

  return { userFiles, generalFiles, audioFiles, otherFiles };
}

export function filterScoreCandidatesForUser(
  files: PieceFileWithLinks[],
  userPartIds: string[],
): PieceFileWithLinks[] {
  const scores = files.filter((file) => file.kind === 'score');

  if (userPartIds.length === 0) {
    return scores;
  }

  const matched = scores.filter(
    (file) =>
      file.partLinks.length > 0 && pieceFileMatchesUserParts(file, userPartIds),
  );
  const general = scores.filter((file) => isGeneralScoreFile(file));

  const seen = new Set<string>();
  const result: PieceFileWithLinks[] = [];

  for (const file of matched) {
    if (seen.has(file.id)) {
      continue;
    }
    seen.add(file.id);
    result.push(file);
  }

  for (const file of general) {
    if (seen.has(file.id)) {
      continue;
    }
    seen.add(file.id);
    result.push(file);
  }

  return result;
}

export function resolveDefaultScoreFile(
  candidates: PieceFileWithLinks[],
): PieceFileWithLinks | null {
  if (candidates.length === 1) {
    return candidates[0];
  }
  return null;
}

export function validateCreateReadingPlaylistInput(
  input: CreateReadingPlaylistInput,
): string | null {
  if (!isValidTitle(input.name)) {
    return 'invalid_name';
  }
  if (!input.items || input.items.length === 0) {
    return 'empty_playlist';
  }
  for (const item of input.items) {
    if (!item.pieceFileId.trim()) {
      return 'invalid_file';
    }
  }
  return null;
}

export function validateUpdateReadingPlaylistInput(
  input: UpdateReadingPlaylistInput,
): string | null {
  if (input.name !== undefined && !isValidTitle(input.name)) {
    return 'invalid_name';
  }
  return null;
}

export const EVENT_SOURCED_PLAYLIST_TTL_MS = 24 * 60 * 60 * 1000;

export function eventSourcedPlaylistExpiresAt(
  startsAt: string,
  endsAt: string | null,
): Date {
  const eventTime = new Date(endsAt ?? startsAt);
  return new Date(eventTime.getTime() + EVENT_SOURCED_PLAYLIST_TTL_MS);
}

export function isEventSourcedPlaylistExpired(
  startsAt: string,
  endsAt: string | null,
  now: Date = new Date(),
): boolean {
  const expiresAt = eventSourcedPlaylistExpiresAt(startsAt, endsAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return true;
  }
  return now.getTime() >= expiresAt.getTime();
}
