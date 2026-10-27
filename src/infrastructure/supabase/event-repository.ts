import type { EventRepository, ListEventsInRangeOptions } from '@/application/ports/event-repository';
import type {
  EventAudienceGroup,
  EventAudienceMusician,
  EventDetail,
  EventInput,
  EventKind,
  EventListItem,
  MusicianEventHistory,
  MusicianEventHistorySourceRow,
  PieceEventHistory,
  PieceEventHistorySourceRow,
  ProgramItemInput,
  ProgramItemStatus,
} from '@/domain/agenda';
import {
  buildMusicianEventHistory,
  countPiecePerformancesInLocalYear,
  findLastPiecePerformanceAt,
  mergePieceEventHistoryRows,
} from '@/domain/agenda';
import type { GroupKind } from '@/domain/ensemble';
import { eventAllParticipantsAbsent, normalizeOptionalText, uniqueIds } from '@/domain/agenda';
import { supabase } from './client';

const EVENT_TYPE_COLUMNS = 'id, organization_id, name, kind, sort_order, color';

const EVENT_COLUMNS =
  'id, organization_id, type_id, title, starts_at, ends_at, location, notes, created_by, recurrence_id, occurrence_index, original_starts_at, is_exception, cancelled_at';

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
  created_by: string | null;
  recurrence_id: string | null;
  occurrence_index: number | null;
  original_starts_at: string | null;
  is_exception: boolean;
  cancelled_at: string | null;
  event_types: EventTypeRow | EventTypeRow[] | null;
};

type AudienceByEvent = {
  groups: EventAudienceGroup[];
  musicians: EventAudienceMusician[];
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

type HistoryEventJoinRow = {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
  type_id: string;
  event_types: EventTypeRow | EventTypeRow[] | null;
};

function mapMusicianHistorySourceRow(
  event: HistoryEventJoinRow,
  wasAbsent: boolean,
): MusicianEventHistorySourceRow | null {
  const eventType = event.event_types
    ? Array.isArray(event.event_types)
      ? (event.event_types[0] ?? null)
      : event.event_types
    : null;

  return {
    eventId: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    cancelledAt: event.cancelled_at,
    typeId: event.type_id,
    typeName: eventType?.name ?? 'Evento',
    typeKind: eventType?.kind ?? 'special',
    typeColor: eventType?.color ?? null,
    wasAbsent,
  };
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

async function loadAudience(
  organizationId: string,
  eventIds: string[],
): Promise<Map<string, AudienceByEvent>> {
  const byEvent = new Map<string, AudienceByEvent>();
  for (const eventId of eventIds) {
    byEvent.set(eventId, { groups: [], musicians: [] });
  }

  if (eventIds.length === 0) {
    return byEvent;
  }

  const [{ data: groupRows }, { data: musicianRows }] = await Promise.all([
    supabase
      .from('event_groups')
      .select('event_id, group_id, groups(name, kind)')
      .eq('organization_id', organizationId)
      .in('event_id', eventIds),
    supabase
      .from('event_musicians')
      .select('event_id, musician_id, musicians(full_name, user_id)')
      .eq('organization_id', organizationId)
      .in('event_id', eventIds),
  ]);

  for (const row of groupRows ?? []) {
    const entry = byEvent.get(row.event_id) ?? { groups: [], musicians: [] };
    const group = row.groups as unknown as { name: string; kind: GroupKind } | null;
    entry.groups.push({
      id: row.group_id,
      name: group?.name ?? '',
      kind: group?.kind ?? 'other',
    });
    byEvent.set(row.event_id, entry);
  }

  for (const row of musicianRows ?? []) {
    const entry = byEvent.get(row.event_id) ?? { groups: [], musicians: [] };
    const musician = row.musicians as unknown as {
      full_name: string;
      user_id: string | null;
    } | null;
    entry.musicians.push({
      id: row.musician_id,
      fullName: musician?.full_name ?? '',
      userId: musician?.user_id ?? null,
    });
    byEvent.set(row.event_id, entry);
  }

  return byEvent;
}

async function loadMusicianIdsByGroupId(
  organizationId: string,
  groupIds: string[],
): Promise<Map<string, string[]>> {
  const byGroup = new Map<string, string[]>();
  if (groupIds.length === 0) {
    return byGroup;
  }

  const { data, error } = await supabase
    .from('assignments')
    .select('musician_id, group_id')
    .eq('organization_id', organizationId)
    .in('group_id', groupIds);

  if (error || !data) {
    return byGroup;
  }

  const setsByGroup = new Map<string, Set<string>>();
  for (const row of data) {
    const ids = setsByGroup.get(row.group_id) ?? new Set<string>();
    ids.add(row.musician_id);
    setsByGroup.set(row.group_id, ids);
  }

  for (const [groupId, musicianIds] of setsByGroup) {
    byGroup.set(groupId, [...musicianIds]);
  }

  return byGroup;
}

async function loadAbsentMusicianIdsByEvent(
  organizationId: string,
  eventIds: string[],
): Promise<Map<string, string[]>> {
  const byEvent = new Map<string, string[]>();
  for (const eventId of eventIds) {
    byEvent.set(eventId, []);
  }

  if (eventIds.length === 0) {
    return byEvent;
  }

  const { data, error } = await supabase
    .from('event_absences')
    .select('event_id, musician_id')
    .eq('organization_id', organizationId)
    .in('event_id', eventIds);

  if (error || !data) {
    return byEvent;
  }

  const setsByEvent = new Map<string, Set<string>>();
  for (const row of data) {
    const ids = setsByEvent.get(row.event_id) ?? new Set<string>();
    ids.add(row.musician_id);
    setsByEvent.set(row.event_id, ids);
  }

  for (const [eventId, musicianIds] of setsByEvent) {
    byEvent.set(eventId, [...musicianIds]);
  }

  return byEvent;
}

function participantMusicianIdsForEvent(
  audience: AudienceByEvent,
  musicianIdsByGroupId: Map<string, string[]>,
): string[] {
  const ids = new Set<string>();
  for (const musician of audience.musicians) {
    ids.add(musician.id);
  }
  for (const group of audience.groups) {
    for (const musicianId of musicianIdsByGroupId.get(group.id) ?? []) {
      ids.add(musicianId);
    }
  }
  return [...ids];
}

async function loadMusicianIdByUserId(
  organizationId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const byUserId = new Map<string, string>();
  const uniqueUserIds = uniqueIds(userIds);
  if (uniqueUserIds.length === 0) {
    return byUserId;
  }

  const { data, error } = await supabase
    .from('musicians')
    .select('id, user_id')
    .eq('organization_id', organizationId)
    .in('user_id', uniqueUserIds);

  if (error || !data) {
    return byUserId;
  }

  for (const row of data) {
    if (row.user_id) {
      byUserId.set(row.user_id, row.id);
    }
  }

  return byUserId;
}

async function loadProgramForEvent(organizationId: string, eventId: string) {
  const { data, error } = await supabase
    .from('program_items')
    .select(
      'id, organization_id, event_id, piece_id, sort_order, notes, status, pieces (title, deleted_at, file_organization, piece_categories (name, slug, color))',
    )
    .eq('organization_id', organizationId)
    .eq('event_id', eventId)
    .order('sort_order');

  if (error || !data) {
    return [];
  }

  const programItemIds = data.map((row) => row.id);
  const unitsByProgramItem = new Map<
    string,
    Array<{
      id: string;
      pieceFileId: string;
      sortOrder: number;
      startPage: number | null;
      endPage: number | null;
      navigationShortcutId: string | null;
      pieceFileTocEntryId: string | null;
      label: string | null;
      pieceFileTitle: string;
      navigationShortcutLabel: string | null;
      navigationShortcutTargetPage: number | null;
      pieceFileTocEntryLabel: string | null;
      pieceFileTocEntryTargetPage: number | null;
      pieceFileTocEntryEndPage: number | null;
    }>
  >();

  if (programItemIds.length > 0) {
    const { data: unitRows, error: unitsError } = await supabase
      .from('program_item_units')
      .select(
        'id, program_item_id, piece_file_id, sort_order, start_page, end_page, navigation_shortcut_id, piece_file_toc_entry_id, label, piece_files (title), piece_file_navigation_shortcuts (label, target_page_number), piece_file_toc_entries (label, target_page_number, end_page_number)',
      )
      .eq('organization_id', organizationId)
      .in('program_item_id', programItemIds)
      .order('sort_order');

    if (!unitsError && unitRows) {
      for (const row of unitRows) {
        const file = row.piece_files as unknown as { title: string } | null;
        const shortcut = row.piece_file_navigation_shortcuts as unknown as {
          label: string;
          target_page_number: number;
        } | null;
        const tocEntry = row.piece_file_toc_entries as unknown as {
          label: string;
          target_page_number: number;
          end_page_number: number | null;
        } | null;
        const list = unitsByProgramItem.get(row.program_item_id) ?? [];
        list.push({
          id: row.id,
          pieceFileId: row.piece_file_id,
          sortOrder: row.sort_order,
          startPage: row.start_page,
          endPage: row.end_page,
          navigationShortcutId: row.navigation_shortcut_id,
          pieceFileTocEntryId: row.piece_file_toc_entry_id,
          label: row.label,
          pieceFileTitle: file?.title ?? 'Arquivo removido',
          navigationShortcutLabel: shortcut?.label ?? null,
          navigationShortcutTargetPage: shortcut?.target_page_number ?? null,
          pieceFileTocEntryLabel: tocEntry?.label ?? null,
          pieceFileTocEntryTargetPage: tocEntry?.target_page_number ?? null,
          pieceFileTocEntryEndPage: tocEntry?.end_page_number ?? null,
        });
        unitsByProgramItem.set(row.program_item_id, list);
      }
    }
  }

  return data.map((row) => {
    const piece = row.pieces as unknown as {
      title: string;
      deleted_at: string | null;
      file_organization: 'distributed' | 'sequential' | 'single';
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
      status: row.status,
      pieceTitle: piece?.title ?? 'Obra removida',
      pieceDeleted: piece?.deleted_at != null,
      fileOrganization: piece?.file_organization ?? 'single',
      pieceCategory: category
        ? { name: category.name, slug: category.slug, color: category.color }
        : null,
      units: unitsByProgramItem.get(row.id) ?? [],
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

  const [program, audience] = await Promise.all([
    loadProgramForEvent(organizationId, row.id),
    loadAudience(organizationId, [row.id]),
  ]);
  const eventAudience = audience.get(row.id) ?? { groups: [], musicians: [] };

  return {
    id: row.id,
    organizationId: row.organization_id,
    typeId: row.type_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    notes: row.notes,
    createdBy: row.created_by,
    recurrenceId: row.recurrence_id,
    occurrenceIndex: row.occurrence_index,
    originalStartsAt: row.original_starts_at,
    isException: row.is_exception,
    cancelledAt: row.cancelled_at,
    type: mapEventType(typeRow),
    program,
    groups: eventAudience.groups,
    musicians: eventAudience.musicians,
  };
}

function toEventRow(organizationId: string, input: EventInput) {
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

function toEventInsert(organizationId: string, input: EventInput) {
  return {
    ...toEventRow(organizationId, input),
    created_by: input.createdBy ?? undefined,
  };
}

async function replaceAudience(
  organizationId: string,
  eventId: string,
  groupIds: string[],
  musicianIds: string[],
) {
  const uniqueGroupIds = uniqueIds(groupIds);
  const uniqueMusicianIds = uniqueIds(musicianIds);

  const { error: deleteGroupsError } = await supabase
    .from('event_groups')
    .delete()
    .eq('organization_id', organizationId)
    .eq('event_id', eventId);

  if (deleteGroupsError) {
    throw new Error(deleteGroupsError.message);
  }

  const { error: deleteMusiciansError } = await supabase
    .from('event_musicians')
    .delete()
    .eq('organization_id', organizationId)
    .eq('event_id', eventId);

  if (deleteMusiciansError) {
    throw new Error(deleteMusiciansError.message);
  }

  if (uniqueGroupIds.length > 0) {
    const { error: insertGroupsError } = await supabase.from('event_groups').insert(
      uniqueGroupIds.map((groupId) => ({
        organization_id: organizationId,
        event_id: eventId,
        group_id: groupId,
      })),
    );

    if (insertGroupsError) {
      throw new Error(insertGroupsError.message);
    }
  }

  if (uniqueMusicianIds.length > 0) {
    const { error: insertMusiciansError } = await supabase.from('event_musicians').insert(
      uniqueMusicianIds.map((musicianId) => ({
        organization_id: organizationId,
        event_id: eventId,
        musician_id: musicianId,
      })),
    );

    if (insertMusiciansError) {
      throw new Error(insertMusiciansError.message);
    }
  }
}

function matchesMineFilter(
  item: {
    createdBy: string | null;
    groups: EventAudienceGroup[];
    musicians: EventAudienceMusician[];
  },
  options: ListEventsInRangeOptions,
): boolean {
  if (!options.mineOnly) {
    return true;
  }
  if (options.viewerUserId && item.createdBy === options.viewerUserId) {
    return true;
  }
  if (options.viewerMusicianId && item.musicians.some((musician) => musician.id === options.viewerMusicianId)) {
    return true;
  }
  const viewerGroupIds = options.viewerGroupIds ?? [];
  return item.groups.some((group) => viewerGroupIds.includes(group.id));
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
      let query = supabase
        .from('events')
        .select(`${EVENT_COLUMNS}, event_types (${EVENT_TYPE_COLUMNS})`)
        .eq('organization_id', organizationId)
        .gte('starts_at', options.from)
        .lt('starts_at', options.to)
        .order('starts_at');

      if (options.typeId) {
        query = query.eq('type_id', options.typeId);
      }

      const { data, error } = await query;

      if (error || !data) {
        return [];
      }

      const rows = data as EventRow[];
      const eventIds = rows.map((row) => row.id);
      const [programCounts, audience] = await Promise.all([
        loadProgramCounts(organizationId, eventIds),
        loadAudience(organizationId, eventIds),
      ]);

      const groupIds = uniqueIds(
        [...audience.values()].flatMap((entry) => entry.groups.map((group) => group.id)),
      );
      const creatorUserIds = rows
        .map((row) => row.created_by)
        .filter((userId): userId is string => userId != null);
      const [musicianIdsByGroupId, absentMusicianIdsByEvent, musicianIdByCreatorUserId] =
        await Promise.all([
          loadMusicianIdsByGroupId(organizationId, groupIds),
          loadAbsentMusicianIdsByEvent(organizationId, eventIds),
          loadMusicianIdByUserId(organizationId, creatorUserIds),
        ]);

      const items: EventListItem[] = [];
      for (const row of rows) {
        const typeRow = unwrapEventType(row);
        if (!typeRow) {
          continue;
        }
        if (options.kind && typeRow.kind !== options.kind) {
          continue;
        }
        const eventAudience = audience.get(row.id) ?? { groups: [], musicians: [] };
        if (options.groupId && !eventAudience.groups.some((group) => group.id === options.groupId)) {
          continue;
        }
        const participantMusicianIds = participantMusicianIdsForEvent(
          eventAudience,
          musicianIdsByGroupId,
        );
        const absentMusicianIds = absentMusicianIdsByEvent.get(row.id) ?? [];
        const creatorMusicianId = row.created_by
          ? musicianIdByCreatorUserId.get(row.created_by)
          : undefined;
        const item: EventListItem = {
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
          createdBy: row.created_by,
          groups: eventAudience.groups,
          musicians: eventAudience.musicians,
          recurrenceId: row.recurrence_id,
          isException: row.is_exception,
          cancelledAt: row.cancelled_at,
          allParticipantsAbsent: eventAllParticipantsAbsent(
            participantMusicianIds,
            absentMusicianIds,
            creatorMusicianId ? [creatorMusicianId] : [],
          ),
        };
        if (!matchesMineFilter(item, options)) {
          continue;
        }
        items.push(item);
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

    async getOccurrenceByIndex(organizationId, recurrenceId, occurrenceIndex) {
      const { data, error } = await supabase
        .from('events')
        .select(`${EVENT_COLUMNS}, event_types (${EVENT_TYPE_COLUMNS})`)
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .eq('occurrence_index', occurrenceIndex)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return buildEventDetail(organizationId, data as EventRow);
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

      await replaceAudience(
        organizationId,
        data.id,
        input.groupIds ?? [],
        input.musicianIds ?? [],
      );

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
        .update(toEventRow(organizationId, input))
        .eq('organization_id', organizationId)
        .eq('id', eventId)
        .select(EVENT_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      await replaceAudience(
        organizationId,
        eventId,
        input.groupIds ?? [],
        input.musicianIds ?? [],
      );

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
        const { data: insertedItems, error: insertError } = await supabase
          .from('program_items')
          .insert(
            items.map((item, index) => ({
              organization_id: organizationId,
              event_id: eventId,
              piece_id: item.pieceId,
              sort_order: index,
              notes: normalizeOptionalText(item.notes),
              status: item.status ?? 'planned',
            })),
          )
          .select('id');

        if (insertError || !insertedItems) {
          throw new Error(insertError?.message ?? 'program_failed');
        }

        const unitRows: Array<{
          organization_id: string;
          program_item_id: string;
          piece_file_id: string;
          sort_order: number;
          start_page: number | null;
          end_page: number | null;
          navigation_shortcut_id: string | null;
          piece_file_toc_entry_id: string | null;
          label: string | null;
        }> = [];

        insertedItems.forEach((inserted, index) => {
          const item = items[index];
          if (!item?.units?.length) {
            return;
          }
          item.units.forEach((unit, unitIndex) => {
            unitRows.push({
              organization_id: organizationId,
              program_item_id: inserted.id,
              piece_file_id: unit.pieceFileId,
              sort_order: unit.sortOrder ?? unitIndex,
              start_page: unit.startPage ?? null,
              end_page: unit.endPage ?? null,
              navigation_shortcut_id: unit.navigationShortcutId ?? null,
              piece_file_toc_entry_id: unit.pieceFileTocEntryId ?? null,
              label: unit.label?.trim() || null,
            });
          });
        });

        if (unitRows.length > 0) {
          const { error: unitsError } = await supabase.from('program_item_units').insert(unitRows);
          if (unitsError) {
            throw new Error(unitsError.message);
          }
        }
      }

      const built = await buildEventDetail(organizationId, existing);
      if (!built) {
        throw new Error('program_failed');
      }
      return built;
    },

    async delete(organizationId, eventId) {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', eventId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async setCancelledAt(organizationId, eventId, cancelledAt) {
      const { error } = await supabase
        .from('events')
        .update({ cancelled_at: cancelledAt })
        .eq('organization_id', organizationId)
        .eq('id', eventId);

      if (error) {
        throw new Error(error.message);
      }

      const row = await fetchEventRow(organizationId, eventId);
      if (!row) {
        throw new Error('not_found');
      }
      const built = await buildEventDetail(organizationId, row);
      if (!built) {
        throw new Error('update_failed');
      }
      return built;
    },

    async bulkCancelFutureOccurrences(organizationId, recurrenceId, fromIndex, cancelledAt, skipExceptions) {
      const { data, error } = await supabase
        .from('events')
        .select('id, is_exception, occurrence_index')
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .gte('occurrence_index', fromIndex);

      if (error) {
        throw new Error(error.message);
      }

      for (const row of data ?? []) {
        if (skipExceptions && row.is_exception) {
          continue;
        }
        const { error: updateError } = await supabase
          .from('events')
          .update({ cancelled_at: cancelledAt })
          .eq('organization_id', organizationId)
          .eq('id', row.id);
        if (updateError) {
          throw new Error(updateError.message);
        }
      }
    },

    async bulkCancelOccurrencesFromInstant(
      organizationId,
      recurrenceId,
      fromInstant,
      cancelledAt,
      skipExceptions,
    ) {
      const { data, error } = await supabase
        .from('events')
        .select('id, is_exception, starts_at')
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .gte('starts_at', fromInstant);

      if (error) {
        throw new Error(error.message);
      }

      for (const row of data ?? []) {
        if (skipExceptions && row.is_exception) {
          continue;
        }
        const { error: updateError } = await supabase
          .from('events')
          .update({ cancelled_at: cancelledAt })
          .eq('organization_id', organizationId)
          .eq('id', row.id);
        if (updateError) {
          throw new Error(updateError.message);
        }
      }
    },

    async markAsException(organizationId, eventId) {
      const { error } = await supabase
        .from('events')
        .update({ is_exception: true })
        .eq('organization_id', organizationId)
        .eq('id', eventId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async bulkUpdateFutureOccurrences(organizationId, recurrenceId, fromIndex, patch, skipExceptions) {
      let query = supabase
        .from('events')
        .select('id, is_exception, occurrence_index')
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .gte('occurrence_index', fromIndex);

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const updateRow: Record<string, unknown> = {};
      if (patch.typeId !== undefined) {
        updateRow.type_id = patch.typeId;
      }
      if (patch.title !== undefined) {
        updateRow.title = normalizeOptionalText(patch.title);
      }
      if (patch.startsAt !== undefined) {
        updateRow.starts_at = patch.startsAt;
      }
      if (patch.endsAt !== undefined) {
        updateRow.ends_at = patch.endsAt;
      }
      if (patch.location !== undefined) {
        updateRow.location = normalizeOptionalText(patch.location);
      }
      if (patch.notes !== undefined) {
        updateRow.notes = normalizeOptionalText(patch.notes);
      }

      for (const row of data ?? []) {
        if (skipExceptions && row.is_exception) {
          continue;
        }
        const { error: updateError } = await supabase
          .from('events')
          .update(updateRow)
          .eq('organization_id', organizationId)
          .eq('id', row.id);
        if (updateError) {
          throw new Error(updateError.message);
        }
      }
    },

    async replaceAudienceForFutureOccurrences(
      organizationId,
      recurrenceId,
      fromIndex,
      groupIds,
      musicianIds,
      skipExceptions,
    ) {
      const { data, error } = await supabase
        .from('events')
        .select('id, is_exception, occurrence_index')
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .gte('occurrence_index', fromIndex);

      if (error) {
        throw new Error(error.message);
      }

      for (const row of data ?? []) {
        if (skipExceptions && row.is_exception) {
          continue;
        }
        await replaceAudience(organizationId, row.id, groupIds, musicianIds);
      }
    },

    async getPieceEventHistory(organizationId, pieceId): Promise<PieceEventHistory> {
      const { data, error } = await supabase
        .from('program_items')
        .select(
          'status, sort_order, events!inner (id, title, starts_at, ends_at, cancelled_at, type_id, event_types (name, kind, color))',
        )
        .eq('organization_id', organizationId)
        .eq('piece_id', pieceId);

      if (error || !data) {
        return { events: [], performancesThisYear: 0, lastPerformanceAt: null };
      }

      const sourceRows: PieceEventHistorySourceRow[] = [];

      for (const row of data) {
        const event = row.events as unknown as {
          id: string;
          title: string | null;
          starts_at: string;
          ends_at: string | null;
          cancelled_at: string | null;
          type_id: string;
          event_types: EventTypeRow | EventTypeRow[] | null;
        } | null;

        if (!event) {
          continue;
        }

        const eventType = event.event_types
          ? Array.isArray(event.event_types)
            ? (event.event_types[0] ?? null)
            : event.event_types
          : null;

        sourceRows.push({
          eventId: event.id,
          sortOrder: row.sort_order,
          status: row.status as ProgramItemStatus,
          title: event.title,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          cancelledAt: event.cancelled_at,
          typeId: event.type_id,
          typeName: eventType?.name ?? 'Evento',
          typeKind: eventType?.kind ?? 'special',
          typeColor: eventType?.color ?? null,
        });
      }

      const events = mergePieceEventHistoryRows(sourceRows);
      const performancesThisYear = countPiecePerformancesInLocalYear(sourceRows);
      const lastPerformanceAt = findLastPiecePerformanceAt(sourceRows);

      return { events, performancesThisYear, lastPerformanceAt };
    },

    async getMusicianEventHistory(organizationId, musicianId, groupIds): Promise<MusicianEventHistory> {
      const eventSelect =
        'id, title, starts_at, ends_at, cancelled_at, type_id, event_types (name, kind, color)';

      const [directResult, indirectResult, absencesResult] = await Promise.all([
        supabase
          .from('event_musicians')
          .select(`events!inner (${eventSelect})`)
          .eq('organization_id', organizationId)
          .eq('musician_id', musicianId),
        groupIds.length > 0
          ? supabase
              .from('event_groups')
              .select(`events!inner (${eventSelect})`)
              .eq('organization_id', organizationId)
              .in('group_id', groupIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('event_absences')
          .select('event_id')
          .eq('organization_id', organizationId)
          .eq('musician_id', musicianId),
      ]);

      if (directResult.error || indirectResult.error || absencesResult.error) {
        return buildMusicianEventHistory([]);
      }

      const absentEventIds = new Set(
        (absencesResult.data ?? []).map((row) => row.event_id as string),
      );
      const byEventId = new Map<string, MusicianEventHistorySourceRow>();

      const ingest = (joinedEvent: HistoryEventJoinRow | null) => {
        if (!joinedEvent) {
          return;
        }
        const mapped = mapMusicianHistorySourceRow(
          joinedEvent,
          absentEventIds.has(joinedEvent.id),
        );
        if (!mapped) {
          return;
        }
        byEventId.set(mapped.eventId, mapped);
      };

      for (const row of directResult.data ?? []) {
        ingest(row.events as unknown as HistoryEventJoinRow | null);
      }

      for (const row of indirectResult.data ?? []) {
        ingest(row.events as unknown as HistoryEventJoinRow | null);
      }

      return buildMusicianEventHistory([...byEventId.values()]);
    },
  };
}
