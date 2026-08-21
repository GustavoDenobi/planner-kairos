import type { EventAbsenceRepository } from '@/application/ports/event-absence-repository';
import type { EventAbsence } from '@/domain/agenda';
import { supabase } from './client';

function mapAbsence(row: {
  musician_id: string;
  marked_by: string;
  marked_at: string;
}): EventAbsence {
  return {
    musicianId: row.musician_id,
    markedBy: row.marked_by,
    markedAt: row.marked_at,
  };
}

export function createEventAbsenceRepository(): EventAbsenceRepository {
  return {
    async listForEvent(organizationId, eventId) {
      const { data, error } = await supabase
        .from('event_absences')
        .select('musician_id, marked_by, marked_at')
        .eq('organization_id', organizationId)
        .eq('event_id', eventId);

      if (error || !data) {
        return [];
      }

      return data.map(mapAbsence);
    },

    async markAbsent(organizationId, eventId, musicianId, markedBy) {
      const { error } = await supabase.from('event_absences').insert({
        organization_id: organizationId,
        event_id: eventId,
        musician_id: musicianId,
        marked_by: markedBy,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async unmarkAbsent(organizationId, eventId, musicianId) {
      const { error } = await supabase
        .from('event_absences')
        .delete()
        .eq('organization_id', organizationId)
        .eq('event_id', eventId)
        .eq('musician_id', musicianId);

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
