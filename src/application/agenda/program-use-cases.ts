import type { EventRepository } from '@/application/ports/event-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { ProgramItemDetail, ProgramItemInput } from '@/domain/agenda';
import { validateProgramItems } from '@/domain/agenda';
import { Result } from '@/domain/shared';

export type PreviousEventProgram = {
  eventId: string;
  startsAt: string;
  endsAt: string | null;
  program: ProgramItemDetail[];
};

export async function getPreviousEventProgram(
  eventRepo: EventRepository,
  organizationId: string,
  eventId: string,
) {
  const existing = await eventRepo.getById(organizationId, eventId);
  if (!existing) {
    return Result.fail('not_found');
  }

  if (!existing.recurrenceId || existing.occurrenceIndex == null || existing.occurrenceIndex <= 0) {
    return Result.ok(null);
  }

  const previous = await eventRepo.getOccurrenceByIndex(
    organizationId,
    existing.recurrenceId,
    existing.occurrenceIndex - 1,
  );

  if (!previous) {
    return Result.ok(null);
  }

  return Result.ok({
    eventId: previous.id,
    startsAt: previous.startsAt,
    endsAt: previous.endsAt,
    program: previous.program,
  } satisfies PreviousEventProgram);
}

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
