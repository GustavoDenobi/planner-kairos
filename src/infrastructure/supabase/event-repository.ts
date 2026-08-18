import type { EventRepository, ListEventsInRangeOptions } from '@/application/ports/event-repository';
import type {
  EventDetail,
  EventInput,
  EventKind,
  EventListItem,
  ProgramItemInput,
} from '@/domain/agenda';
import { normalizeOptionalText } from '@/domain/agenda';
import { supabase } from './client';

const EVENT_TYPE_COLUMNS = 'id, organization_id, name, kind, sort_order, color';

const EVENT_COLUMNS =
  'id, organization_id, type_id, title, starts_at, ends_at, location, notes';

type EventTypeRow = {
  id: string;
  organization_id: string;
  name: string;
  kind: EventKind;
  sort_order: number;
  color: string | null;
};

type EventRow = {
  id: string;
  organization_id: string;
  type_id: string;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  event_types: EventTypeRow | EventTypeRow[] | null;
};

function mapEventType(row: EventTypeRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    kind: row.kind,
    sortOrder: row.sort_order,
    color: row.color,
  };
}

function unwrapEventType(row: EventRow): EventTypeRow | null {
  if (!row.event_types) {
    return null;
  }
  return Array.isArray(row.event_types) ? (row.event_types[0] ?? null) : row.event_types;
}

async function loadProgramCounts(
  organizationId: string,
  eventIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase
    .from('program_items')
    .select('event_id')
    .eq('organization_id', organizationId)
    .in('event_id', eventIds);

  if (error || !data) {
    return counts;
  }

  for (const row of data) {
    counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
  }

  return counts;
}

async function loadProgramForEvent(organizationId: string, eventId: string) {
  const { data, error } = await supabase
    .from('program_items')
    .select(
      'id, organization_id, event_id, piece_id, sort_order, notes, pieces (title, deleted_at, piece_categories (name, slug, color))',
    )
    .eq('organization_id', organizationId)
    .eq('event_id', eventId)
    .order('sort_order');

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const piece = row.pieces as unknown as {
      title: string;
      deleted_at: string | null;
      piece_categories: { name: string; slug: string; color: string | null } | null;
    } | null;
    const category = piece?.piece_categories;
    return {
      id: row.id,
      organizationId: row.organization_id,
      eventId: row.event_id,
      pieceId: row.piece_id,
      sortOrder: row.sort_order,
      notes: row.notes,
      pieceTitle: piece?.title ?? 'Obra removida',
      pieceDeleted: piece?.deleted_at != null,
      pieceCategory: category
        ? { name: category.name, slug: category.slug, color: category.color }
        : null,
    };
  });
}

async function buildEventDetail(
  organizationId: string,
  row: EventRow,
): Promise<EventDetail | null> {
  const typeRow = unwrapEventType(row);
  if (!typeRow) {
    return null;
  }

  const program = await loadProgramForEvent(organizationId, row.id);

  return {
    id: row.id,
    organizationId: row.organization_id,
    typeId: row.type_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    notes: row.notes,
    type: mapEventType(typeRow),
    program,
  };
}

function toEventInsert(organizationId: string, input: EventInput) {
  return {
    organization_id: organizationId,
    type_id: input.typeId,
    title: normalizeOptionalText(input.title),
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    location: normalizeOptionalText(input.location),
    notes: normalizeOptionalText(input.notes),
  };
}

async function fetchEventRow(
  organizationId: string,
  eventId: string,
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`${EVENT_COLUMNS}, event_types (${EVENT_TYPE_COLUMNS})`)
    .eq('organization_id', organizationId)
    .eq('id', eventId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as EventRow;
}

export function createEventRepository(): EventRepository {
  return {
    async listInRange(organizationId, options: ListEventsInRangeOptions) {
      const { data, error } = await supabase
        .from('events')
        .select(`${EVENT_COLUMNS}, event_types (${EVENT_TYPE_COLUMNS})`)
        .eq('organization_id', organizationId)
        .gte('starts_at', options.from)
        .lt('starts_at', options.to)
        .order('starts_at');

      if (error || !data) {
        return [];
      }

      const rows = data as EventRow[];
      const programCounts = await loadProgramCounts(
        organizationId,
        rows.map((row) => row.id),
      );

      const items: EventListItem[] = [];
      for (const row of rows) {
        const typeRow = unwrapEventType(row);
        if (!typeRow) {
          continue;
        }
        items.push({
          id: row.id,
          typeId: row.type_id,
          typeName: typeRow.name,
          typeKind: typeRow.kind,
          typeColor: typeRow.color,
          title: row.title,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          location: row.location,
          programCount: programCounts.get(row.id) ?? 0,
        });
      }

      return items;
    },

    async getById(organizationId, eventId) {
      const row = await fetchEventRow(organizationId, eventId);
      if (!row) {
        return null;
      }
      return buildEventDetail(organizationId, row);
    },

    async create(organizationId, input: EventInput) {
      const { data, error } = await supabase
        .from('events')
        .insert(toEventInsert(organizationId, input))
        .select(EVENT_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      const row = await fetchEventRow(organizationId, data.id);
      if (!row) {
        throw new Error('create_failed');
      }
      const built = await buildEventDetail(organizationId, row);
      if (!built) {
        throw new Error('create_failed');
      }
      return built;
    },

    async update(organizationId, eventId, input: EventInput) {
      const { data, error } = await supabase
        .from('events')
        .update(toEventInsert(organizationId, input))
        .eq('organization_id', organizationId)
        .eq('id', eventId)
        .select(EVENT_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      const row = await fetchEventRow(organizationId, data.id);
      if (!row) {
        throw new Error('update_failed');
      }
      const built = await buildEventDetail(organizationId, row);
      if (!built) {
        throw new Error('update_failed');
      }
      return built;
    },

    async replaceProgram(organizationId, eventId, items: ProgramItemInput[]) {
      const existing = await fetchEventRow(organizationId, eventId);
      if (!existing) {
        throw new Error('not_found');
      }

      const { error: deleteError } = await supabase
        .from('program_items')
        .delete()
        .eq('organization_id', organizationId)
        .eq('event_id', eventId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (items.length > 0) {
        const { error: insertError } = await supabase.from('program_items').insert(
          items.map((item, index) => ({
            organization_id: organizationId,
            event_id: eventId,
            piece_id: item.pieceId,
            sort_order: index,
            notes: normalizeOptionalText(item.notes),
          })),
        );

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      const built = await buildEventDetail(organizationId, existing);
      if (!built) {
        throw new Error('program_failed');
      }
      return built;
    },
  };
}
