import type { EventTypeRepository } from '@/application/ports/event-type-repository';
import type { EventKind, EventType, EventTypeInput } from '@/domain/agenda';
import { supabase } from './client';

const EVENT_TYPE_COLUMNS = 'id, organization_id, name, kind, sort_order, color';

function mapEventType(row: {
  id: string;
  organization_id: string;
  name: string;
  kind: EventKind;
  sort_order: number;
  color: string | null;
}): EventType {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    kind: row.kind,
    sortOrder: row.sort_order,
    color: row.color,
  };
}

export function createEventTypeRepository(): EventTypeRepository {
  return {
    async list(organizationId) {
      const { data, error } = await supabase
        .from('event_types')
        .select(EVENT_TYPE_COLUMNS)
        .eq('organization_id', organizationId)
        .order('sort_order')
        .order('name');

      if (error || !data) {
        return [];
      }

      return data.map(mapEventType);
    },

    async create(organizationId, input: EventTypeInput) {
      const { data, error } = await supabase
        .from('event_types')
        .insert({
          organization_id: organizationId,
          name: input.name.trim(),
          kind: input.kind,
          sort_order: input.sortOrder ?? 0,
          color: input.color ?? null,
        })
        .select(EVENT_TYPE_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapEventType(data);
    },

    async update(organizationId, typeId, input: EventTypeInput) {
      const { data, error } = await supabase
        .from('event_types')
        .update({
          name: input.name.trim(),
          kind: input.kind,
          sort_order: input.sortOrder,
          color: input.color ?? null,
        })
        .eq('organization_id', organizationId)
        .eq('id', typeId)
        .select(EVENT_TYPE_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapEventType(data);
    },

    async delete(organizationId, typeId) {
      const { error } = await supabase
        .from('event_types')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', typeId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async countEventsUsingType(organizationId, typeId) {
      const { count, error } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('type_id', typeId);

      if (error) {
        return 0;
      }

      return count ?? 0;
    },
  };
}
