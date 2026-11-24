import type { EventRepository } from '@/application/ports/event-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { PieceFileTocEntryRepository } from '@/application/ports/piece-file-toc-entry-repository';
import type {
  AppendPieceToEventResult,
  ProgramItemDetail,
  ProgramItemInput,
  ProgramItemUnitInput,
} from '@/domain/agenda';
import { buildProgramItemValidationContext, validateProgramItems } from '@/domain/agenda';
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
  tocRepo: PieceFileTocEntryRepository,
  organizationId: string,
  eventId: string,
  items: ProgramItemInput[],
) {
  const existing = await eventRepo.getById(organizationId, eventId);
  if (!existing) {
    return Result.fail('not_found');
  }

  const pieceIds = [...new Set(items.map((item) => item.pieceId))];
  const pieces = await Promise.all(
    pieceIds.map((pieceId) => pieceRepo.getById(organizationId, pieceId)),
  );

  for (const piece of pieces) {
    if (!piece) {
      return Result.fail('piece_not_found');
    }
    if (piece.deletedAt) {
      return Result.fail('piece_deleted');
    }
  }

  const validPieces = pieces.filter((piece): piece is NonNullable<typeof piece> => piece != null);
  const tocEntriesByPieceId = new Map<string, Awaited<ReturnType<PieceFileTocEntryRepository['listForPiece']>>>();
  await Promise.all(
    validPieces.map(async (piece) => {
      const entries = await tocRepo.listForPiece(organizationId, piece.id);
      tocEntriesByPieceId.set(piece.id, entries);
    }),
  );

  const validationContext = buildProgramItemValidationContext(validPieces, tocEntriesByPieceId);
  const validationError = validateProgramItems(items, validationContext);
  if (validationError) {
    return Result.fail(validationError);
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

/**
 * Acrescenta a obra (inteira ou com trechos) ao fim da programação de vários eventos.
 * Valida os trechos uma vez e devolve o resultado por evento (adicionado, sem permissão etc.).
 */
export async function appendPieceToEvents(
  eventRepo: EventRepository,
  pieceRepo: PieceRepository,
  tocRepo: PieceFileTocEntryRepository,
  organizationId: string,
  pieceId: string,
  eventIds: string[],
  units: ProgramItemUnitInput[],
) {
  const uniqueEventIds = [...new Set(eventIds)];
  if (uniqueEventIds.length === 0) {
    return Result.ok([] as AppendPieceToEventResult[]);
  }

  const piece = await pieceRepo.getById(organizationId, pieceId);
  if (!piece) {
    return Result.fail('piece_not_found');
  }
  if (piece.deletedAt) {
    return Result.fail('piece_deleted');
  }

  const tocEntries = await tocRepo.listForPiece(organizationId, piece.id);
  const validationContext = buildProgramItemValidationContext(
    [piece],
    new Map([[piece.id, tocEntries]]),
  );
  const validationError = validateProgramItems([{ pieceId, units }], validationContext);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const results = await eventRepo.appendPieceToEventPrograms(
      organizationId,
      pieceId,
      uniqueEventIds,
      units,
    );
    return Result.ok(results);
  } catch (error) {
    if (error instanceof Error && /piece_deleted/i.test(error.message)) {
      return Result.fail('piece_deleted');
    }
    return Result.fail('program_failed');
  }
}

export async function listPieceProgramEntries(
  eventRepo: EventRepository,
  organizationId: string,
  pieceId: string,
  eventIds: string[],
) {
  try {
    const entries = await eventRepo.listPieceProgramEntries(organizationId, pieceId, eventIds);
    return Result.ok(entries);
  } catch {
    return Result.fail('program_failed');
  }
}
