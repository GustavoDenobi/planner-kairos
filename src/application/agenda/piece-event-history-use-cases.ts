import type { EventRepository } from '@/application/ports/event-repository';
import type { PieceEventHistory } from '@/domain/agenda';
import { Result } from '@/domain/shared';

export async function getPieceEventHistory(
  eventRepo: EventRepository,
  organizationId: string,
  pieceId: string,
) {
  const history: PieceEventHistory = await eventRepo.getPieceEventHistory(
    organizationId,
    pieceId,
  );
  return Result.ok(history);
}
