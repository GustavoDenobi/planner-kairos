import type { EventAbsence } from '@/domain/agenda';

export type EventAbsenceRepository = {
  listForEvent(organizationId: string, eventId: string): Promise<EventAbsence[]>;
  markAbsent(
    organizationId: string,
    eventId: string,
    musicianId: string,
    markedBy: string,
  ): Promise<void>;
  unmarkAbsent(organizationId: string, eventId: string, musicianId: string): Promise<void>;
};
