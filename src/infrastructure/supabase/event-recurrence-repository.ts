import type {
  EventRecurrenceRepository,
  CreateRecurrencePayload,
} from '@/application/ports/event-recurrence-repository';
import type { EventRecurrence, RecurrenceRule } from '@/domain/agenda';
import { normalizeOptionalText, uniqueIds } from '@/domain/agenda';
import { supabase } from './client';

const RECURRENCE_COLUMNS =
  'id, organization_id, type_id, title, location, notes, duration_minutes, series_starts_at, series_ends_at, rule, limit_anchor_at, cancelled_at, created_by';

type RecurrenceRow = {
  id: string;
  organization_id: string;
  type_id: string;
  title: string | null;
  location: string | null;
  notes: string | null;
  duration_minutes: number | null;
  series_starts_at: string;
  series_ends_at: string;
  rule: RecurrenceRule;
  limit_anchor_at: string;
  cancelled_at: string | null;
  created_by: string | null;
};

async function loadRecurrenceAudience(
  organizationId: string,
  recurrenceId: string,
): Promise<{ groupIds: string[]; musicianIds: string[] }> {
  const [{ data: groupRows }, { data: musicianRows }] = await Promise.all([
    supabase
      .from('event_recurrence_groups')
      .select('group_id')
      .eq('organization_id', organizationId)
      .eq('recurrence_id', recurrenceId),
    supabase
      .from('event_recurrence_musicians')
      .select('musician_id')
      .eq('organization_id', organizationId)
      .eq('recurrence_id', recurrenceId),
  ]);

  return {
    groupIds: (groupRows ?? []).map((row) => row.group_id),
    musicianIds: (musicianRows ?? []).map((row) => row.musician_id),
  };
}

function mapRecurrence(row: RecurrenceRow, audience: { groupIds: string[]; musicianIds: string[] }): EventRecurrence {
  return {
    id: row.id,
    organizationId: row.organization_id,
    typeId: row.type_id,
    title: row.title,
    location: row.location,
    notes: row.notes,
    durationMinutes: row.duration_minutes,
    seriesStartsAt: row.series_starts_at,
    seriesEndsAt: row.series_ends_at,
    rule: row.rule,
    limitAnchorAt: row.limit_anchor_at,
    cancelledAt: row.cancelled_at,
    createdBy: row.created_by,
    groupIds: audience.groupIds,
    musicianIds: audience.musicianIds,
  };
}

async function replaceRecurrenceAudience(
  organizationId: string,
  recurrenceId: string,
  groupIds: string[],
  musicianIds: string[],
) {
  const uniqueGroupIds = uniqueIds(groupIds);
  const uniqueMusicianIds = uniqueIds(musicianIds);

  const { error: deleteGroupsError } = await supabase
    .from('event_recurrence_groups')
    .delete()
    .eq('organization_id', organizationId)
    .eq('recurrence_id', recurrenceId);

  if (deleteGroupsError) {
    throw new Error(deleteGroupsError.message);
  }

  const { error: deleteMusiciansError } = await supabase
    .from('event_recurrence_musicians')
    .delete()
    .eq('organization_id', organizationId)
    .eq('recurrence_id', recurrenceId);

  if (deleteMusiciansError) {
    throw new Error(deleteMusiciansError.message);
  }

  if (uniqueGroupIds.length > 0) {
    const { error } = await supabase.from('event_recurrence_groups').insert(
      uniqueGroupIds.map((groupId) => ({
        organization_id: organizationId,
        recurrence_id: recurrenceId,
        group_id: groupId,
      })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (uniqueMusicianIds.length > 0) {
    const { error } = await supabase.from('event_recurrence_musicians').insert(
      uniqueMusicianIds.map((musicianId) => ({
        organization_id: organizationId,
        recurrence_id: recurrenceId,
        musician_id: musicianId,
      })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }
}

async function copyAudienceToEvent(
  organizationId: string,
  eventId: string,
  groupIds: string[],
  musicianIds: string[],
) {
  const uniqueGroupIds = uniqueIds(groupIds);
  const uniqueMusicianIds = uniqueIds(musicianIds);

  if (uniqueGroupIds.length > 0) {
    const { error } = await supabase.from('event_groups').insert(
      uniqueGroupIds.map((groupId) => ({
        organization_id: organizationId,
        event_id: eventId,
        group_id: groupId,
      })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (uniqueMusicianIds.length > 0) {
    const { error } = await supabase.from('event_musicians').insert(
      uniqueMusicianIds.map((musicianId) => ({
        organization_id: organizationId,
        event_id: eventId,
        musician_id: musicianId,
      })),
    );
    if (error) {
      throw new Error(error.message);
    }
  }
}

const BATCH_SIZE = 50;

export function createEventRecurrenceRepository(): EventRecurrenceRepository {
  return {
    async createWithOccurrences(organizationId, payload: CreateRecurrencePayload) {
      const { input, occurrences, durationMinutes, limitAnchorAt } = payload;
      const seriesEndsAtDate = input.seriesEndsAt.split('T')[0] ?? input.seriesEndsAt;

      const { data: recurrenceRow, error: recurrenceError } = await supabase
        .from('event_recurrences')
        .insert({
          organization_id: organizationId,
          type_id: input.typeId,
          title: normalizeOptionalText(input.title),
          location: normalizeOptionalText(input.location),
          notes: normalizeOptionalText(input.notes),
          duration_minutes: durationMinutes,
          series_starts_at: input.startsAt,
          series_ends_at: `${seriesEndsAtDate}T23:59:59.999Z`,
          rule: input.rule,
          limit_anchor_at: limitAnchorAt,
          created_by: input.createdBy ?? undefined,
        })
        .select(RECURRENCE_COLUMNS)
        .single();

      if (recurrenceError || !recurrenceRow) {
        throw new Error(recurrenceError?.message ?? 'create_failed');
      }

      const groupIds = uniqueIds(input.groupIds ?? []);
      const musicianIds = uniqueIds(input.musicianIds ?? []);
      await replaceRecurrenceAudience(organizationId, recurrenceRow.id, groupIds, musicianIds);

      let firstEventId = '';

      for (let offset = 0; offset < occurrences.length; offset += BATCH_SIZE) {
        const batch = occurrences.slice(offset, offset + BATCH_SIZE);
        const { data: eventRows, error: eventsError } = await supabase
          .from('events')
          .insert(
            batch.map((occurrence) => ({
              organization_id: organizationId,
              type_id: input.typeId,
              title: normalizeOptionalText(input.title),
              location: normalizeOptionalText(input.location),
              notes: normalizeOptionalText(input.notes),
              starts_at: occurrence.startsAt,
              ends_at: occurrence.endsAt,
              created_by: input.createdBy ?? undefined,
              recurrence_id: recurrenceRow.id,
              occurrence_index: occurrence.occurrenceIndex,
              original_starts_at: occurrence.originalStartsAt,
              is_exception: false,
            })),
          )
          .select('id');

        if (eventsError || !eventRows) {
          throw new Error(eventsError?.message ?? 'create_failed');
        }

        for (let index = 0; index < eventRows.length; index += 1) {
          const eventId = eventRows[index]?.id;
          if (!eventId) {
            continue;
          }
          if (!firstEventId) {
            firstEventId = eventId;
          }
          await copyAudienceToEvent(organizationId, eventId, groupIds, musicianIds);
        }
      }

      if (!firstEventId) {
        throw new Error('create_failed');
      }

      const audience = await loadRecurrenceAudience(organizationId, recurrenceRow.id);
      return {
        recurrence: mapRecurrence(recurrenceRow as RecurrenceRow, audience),
        firstEventId,
      };
    },

    async getById(organizationId, recurrenceId) {
      const { data, error } = await supabase
        .from('event_recurrences')
        .select(RECURRENCE_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('id', recurrenceId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const audience = await loadRecurrenceAudience(organizationId, recurrenceId);
      return mapRecurrence(data as RecurrenceRow, audience);
    },

    async cancel(organizationId, recurrenceId, fromInstant) {
      const { error: updateError } = await supabase
        .from('event_recurrences')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('id', recurrenceId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .gte('starts_at', fromInstant);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    },

    async updateTemplate(organizationId, recurrenceId, patch) {
      const updateRow: Record<string, unknown> = {};
      if (patch.typeId !== undefined) {
        updateRow.type_id = patch.typeId;
      }
      if (patch.title !== undefined) {
        updateRow.title = normalizeOptionalText(patch.title);
      }
      if (patch.location !== undefined) {
        updateRow.location = normalizeOptionalText(patch.location);
      }
      if (patch.notes !== undefined) {
        updateRow.notes = normalizeOptionalText(patch.notes);
      }
      if (patch.durationMinutes !== undefined) {
        updateRow.duration_minutes = patch.durationMinutes;
      }
      if (patch.seriesStartsAt !== undefined) {
        updateRow.series_starts_at = patch.seriesStartsAt;
      }
      if (patch.seriesEndsAt !== undefined) {
        const dateOnly = patch.seriesEndsAt.split('T')[0] ?? patch.seriesEndsAt;
        updateRow.series_ends_at = `${dateOnly}T23:59:59.999Z`;
      }
      if (patch.rule !== undefined) {
        updateRow.rule = patch.rule;
      }

      const { data, error } = await supabase
        .from('event_recurrences')
        .update(updateRow)
        .eq('organization_id', organizationId)
        .eq('id', recurrenceId)
        .select(RECURRENCE_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      const audience = await loadRecurrenceAudience(organizationId, recurrenceId);
      return mapRecurrence(data as RecurrenceRow, audience);
    },

    async replaceAudience(organizationId, recurrenceId, groupIds, musicianIds) {
      await replaceRecurrenceAudience(organizationId, recurrenceId, groupIds, musicianIds);
    },

    async deleteOccurrencesFromIndex(organizationId, recurrenceId, fromIndex, includeFromIndex = true) {
      let query = supabase
        .from('events')
        .select('id, occurrence_index')
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId);

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const ids = (data ?? [])
        .filter((row) =>
          includeFromIndex ? row.occurrence_index >= fromIndex : row.occurrence_index > fromIndex,
        )
        .map((row) => row.id);

      if (ids.length === 0) {
        return;
      }

      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('organization_id', organizationId)
        .in('id', ids);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    },

    async deleteOccurrencesAfterDate(organizationId, recurrenceId, afterInstant) {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .gt('starts_at', afterInstant);

      if (error) {
        throw new Error(error.message);
      }
    },

    async listOccurrenceSummaries(organizationId, recurrenceId) {
      const { data, error } = await supabase
        .from('events')
        .select('id, occurrence_index, starts_at, is_exception')
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .order('occurrence_index');

      if (error || !data) {
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        occurrenceIndex: row.occurrence_index ?? 0,
        startsAt: row.starts_at,
        isException: row.is_exception,
      }));
    },

    async truncateSeriesEnd(organizationId, recurrenceId, seriesEndsAt) {
      const dateOnly = seriesEndsAt.split('T')[0] ?? seriesEndsAt;
      const { error } = await supabase
        .from('event_recurrences')
        .update({ series_ends_at: `${dateOnly}T23:59:59.999Z` })
        .eq('organization_id', organizationId)
        .eq('id', recurrenceId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async deleteNonExceptionOccurrencesFromInstant(organizationId, recurrenceId, fromInstant) {
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('recurrence_id', recurrenceId)
        .eq('is_exception', false)
        .gte('starts_at', fromInstant);

      if (error) {
        throw new Error(error.message);
      }

      const ids = (data ?? []).map((row) => row.id);
      if (ids.length === 0) {
        return;
      }

      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('organization_id', organizationId)
        .in('id', ids);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    },

    async insertOccurrences(organizationId, recurrence, occurrences) {
      if (occurrences.length === 0) {
        return;
      }

      for (let offset = 0; offset < occurrences.length; offset += BATCH_SIZE) {
        const batch = occurrences.slice(offset, offset + BATCH_SIZE);
        const { data: eventRows, error: eventsError } = await supabase
          .from('events')
          .insert(
            batch.map((occurrence) => ({
              organization_id: organizationId,
              type_id: recurrence.typeId,
              title: recurrence.title,
              location: recurrence.location,
              notes: recurrence.notes,
              starts_at: occurrence.startsAt,
              ends_at: occurrence.endsAt,
              created_by: recurrence.createdBy ?? undefined,
              recurrence_id: recurrence.id,
              occurrence_index: occurrence.occurrenceIndex,
              original_starts_at: occurrence.originalStartsAt,
              is_exception: false,
            })),
          )
          .select('id');

        if (eventsError || !eventRows) {
          throw new Error(eventsError?.message ?? 'create_failed');
        }

        for (const eventRow of eventRows) {
          if (!eventRow?.id) {
            continue;
          }
          await copyAudienceToEvent(
            organizationId,
            eventRow.id,
            recurrence.groupIds,
            recurrence.musicianIds,
          );
        }
      }
    },
  };
}
