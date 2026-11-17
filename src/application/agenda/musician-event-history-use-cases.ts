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

/** Histórico de eventos de vários músicos (ex.: integrantes de um grupo), com a mesma regra do histórico individual. */
export async function getMusiciansEventHistory(
  eventRepo: EventRepository,
  assignmentRepo: AssignmentRepository,
  organizationId: string,
  musicianIds: string[],
) {
  const uniqueMusicianIds = [...new Set(musicianIds)];
  const groupIdsByMusician = new Map<string, string[]>(
    uniqueMusicianIds.map((id) => [id, []]),
  );
  if (uniqueMusicianIds.length > 0) {
    const assignments = await assignmentRepo.listForMusicians(organizationId, uniqueMusicianIds);
    for (const assignment of assignments) {
      const groupIds = groupIdsByMusician.get(assignment.musicianId);
      if (groupIds && !groupIds.includes(assignment.groupId)) {
        groupIds.push(assignment.groupId);
      }
    }
  }
  const history = await eventRepo.getMusiciansEventHistory(organizationId, groupIdsByMusician);
  return Result.ok(history);
}
