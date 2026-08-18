import type { EventRepository } from '@/application/ports/event-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { ProgramItemInput } from '@/domain/agenda';
import { validateProgramItems } from '@/domain/agenda';
import { Result } from '@/domain/shared';

export async function setEventProgram(
  eventRepo: EventRepository,
  pieceRepo: PieceRepository,
  organizationId: string,
  eventId: string,
  items: ProgramItemInput[],
) {
  const existing = await eventRepo.getById(organizationId, eventId);
  if (!existing) {
    return Result.fail('not_found');
  }

  const validationError = validateProgramItems(items);
  if (validationError) {
    return Result.fail(validationError);
  }

  for (const item of items) {
    const piece = await pieceRepo.getById(organizationId, item.pieceId);
    if (!piece) {
      return Result.fail('piece_not_found');
    }
    if (piece.deletedAt) {
      return Result.fail('piece_deleted');
    }
  }

  try {
    const event = await eventRepo.replaceProgram(organizationId, eventId, items);
    return Result.ok(event);
  } catch (error) {
    if (error instanceof Error && /piece_deleted/i.test(error.message)) {
      return Result.fail('piece_deleted');
    }
    return Result.fail('program_failed');
  }
}
