import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { CreatePdfAnnotationInput, UpdatePdfAnnotationInput } from '@/domain/repertoire';
import {
  validateAnnotationGeometry,
  validateCreatePdfAnnotationInput,
} from '@/domain/repertoire';
import { Result } from '@/domain/shared';

export async function listPieceFileAnnotations(
  annotationRepo: PieceFileAnnotationRepository,
  organizationId: string,
  pieceFileId: string,
) {
  const annotations = await annotationRepo.listForFile(organizationId, pieceFileId);
  return Result.ok(annotations);
}

export async function createPieceFileAnnotation(
  fileRepo: PieceFileRepository,
  annotationRepo: PieceFileAnnotationRepository,
  organizationId: string,
  pieceId: string,
  authorUserId: string,
  input: CreatePdfAnnotationInput,
) {
  const validationError = validateCreatePdfAnnotationInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const file = await fileRepo.getById(organizationId, pieceId, input.pieceFileId);
  if (!file) {
    return Result.fail('not_found');
  }

  if (file.kind !== 'score') {
    return Result.fail('invalid_file_kind');
  }

  try {
    const annotation = await annotationRepo.create(organizationId, authorUserId, input);
    return Result.ok(annotation);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updatePieceFileAnnotation(
  annotationRepo: PieceFileAnnotationRepository,
  organizationId: string,
  pieceFileId: string,
  annotationId: string,
  input: UpdatePdfAnnotationInput,
) {
  if (input.geometry) {
    const existing = (await annotationRepo.listForFile(organizationId, pieceFileId)).find(
      (item) => item.id === annotationId,
    );
    if (!existing) {
      return Result.fail('not_found');
    }

    const geometryError = validateAnnotationGeometry(existing.type, input.geometry);
    if (geometryError) {
      return Result.fail(geometryError);
    }
  }

  const updated = await annotationRepo.update(organizationId, pieceFileId, annotationId, input);
  if (!updated) {
    return Result.fail('not_found');
  }

  return Result.ok(updated);
}

export async function deletePieceFileAnnotation(
  annotationRepo: PieceFileAnnotationRepository,
  organizationId: string,
  pieceFileId: string,
  annotationId: string,
) {
  const removed = await annotationRepo.remove(organizationId, pieceFileId, annotationId);
  if (!removed) {
    return Result.fail('delete_failed');
  }

  return Result.ok(undefined);
}
