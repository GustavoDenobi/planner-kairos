import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { EventRepository } from '@/application/ports/event-repository';
import { Result } from '@/domain/shared';

export async function getMusicianEventHistory(
  eventRepo: EventRepository,
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  musicianId: string,
) {
  const assignments = await assignmentRepo.listForMusician(organizationId, musicianId);
  const groupIds = [...new Set(assignments.map((assignment) => assignment.groupId))];
  const history = await eventRepo.getMusicianEventHistory(organizationId, musicianId, groupIds);
  return Result.ok(history);
}
