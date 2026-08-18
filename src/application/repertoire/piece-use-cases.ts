import type { PieceRepository, SearchPiecesOptions } from '@/application/ports/piece-repository';
import type { PieceInput } from '@/domain/repertoire';
import { validatePieceInput } from '@/domain/repertoire';
import { Result } from '@/domain/shared';

export async function searchPieces(
  pieceRepo: PieceRepository,
  organizationId: string,
  options?: SearchPiecesOptions,
) {
  const pieces = await pieceRepo.search(organizationId, options);
  return Result.ok(pieces);
}

export async function getPiece(
  pieceRepo: PieceRepository,
  organizationId: string,
  pieceId: string,
) {
  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('not_found');
  }
  return Result.ok(piece);
}

export async function catalogPiece(
  pieceRepo: PieceRepository,
  organizationId: string,
  input: PieceInput,
) {
  const validationError = validatePieceInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const piece = await pieceRepo.create(organizationId, input);
    return Result.ok(piece);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_title');
    }
    return Result.fail('create_failed');
  }
}

export async function updatePiece(
  pieceRepo: PieceRepository,
  organizationId: string,
  pieceId: string,
  input: PieceInput,
) {
  const validationError = validatePieceInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const piece = await pieceRepo.update(organizationId, pieceId, input);
    return Result.ok(piece);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_title');
    }
    return Result.fail('update_failed');
  }
}

export async function softDeletePiece(
  pieceRepo: PieceRepository,
  organizationId: string,
  pieceId: string,
) {
  const existing = await pieceRepo.getById(organizationId, pieceId);
  if (!existing) {
    return Result.fail('not_found');
  }

  try {
    await pieceRepo.softDelete(organizationId, pieceId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}
