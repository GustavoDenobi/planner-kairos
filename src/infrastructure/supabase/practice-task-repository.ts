import type {
  PracticeTaskRecordInput,
  PracticeTaskRepository,
} from '@/application/ports/practice-task-repository';
import type { PracticeTask, PracticeTaskCadence } from '@/domain/practice';
import {
  DEFAULT_ORGANIZATION_TIME_ZONE,
  practiceTaskReferenceFromColumns,
  practiceTaskReferenceToColumns,
} from '@/domain/practice';
import { supabase } from './client';

const TASK_COLUMNS = `
  id, organization_id, created_by, title, instructions,
  piece_id, piece_file_id, toc_entry_id, toc_label_snapshot, target_page, target_x, target_y,
  due_at, accept_late_submissions, cadence, starts_on, ends_on, weekdays,
  linked_event_id, closed_at, created_at, updated_at,
  organizations (time_zone),
  practice_task_groups (group_id, groups (name)),
  practice_task_musicians (musician_id, musicians (full_name))
`;

type TaskRow = {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string;
  instructions: string;
  piece_id: string | null;
  piece_file_id: string | null;
  toc_entry_id: string | null;
  toc_label_snapshot: string | null;
  target_page: number | null;
  target_x: number | null;
  target_y: number | null;
  due_at: string;
  accept_late_submissions: boolean;
  cadence: PracticeTaskCadence;
  starts_on: string | null;
  ends_on: string | null;
  weekdays: number[] | null;
  organizations: { time_zone: string } | null;
  linked_event_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  practice_task_groups: Array<{ group_id: string; groups: { name: string } | null }> | null;
  practice_task_musicians: Array<{
    musician_id: string;
    musicians: { full_name: string } | null;
  }> | null;
};

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
}

function mapTask(row: TaskRow): PracticeTask {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    title: row.title,
    instructions: row.instructions,
    reference: practiceTaskReferenceFromColumns(row),
    cadence: row.cadence,
    daily:
      row.cadence === 'daily' && row.starts_on && row.ends_on && row.weekdays
        ? { startsOn: row.starts_on, endsOn: row.ends_on, weekdays: row.weekdays }
        : null,
    timeZone: row.organizations?.time_zone ?? DEFAULT_ORGANIZATION_TIME_ZONE,
    dueAt: row.due_at,
    acceptLateSubmissions: row.accept_late_submissions,
    linkedEventId: row.linked_event_id,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    groups: (row.practice_task_groups ?? [])
      .map((item) => ({ id: item.group_id, name: item.groups?.name ?? '' }))
      .sort(byName),
    musicians: (row.practice_task_musicians ?? [])
      .map((item) => ({ id: item.musician_id, name: item.musicians?.full_name ?? '' }))
      .sort(byName),
  };
}

function toWriteColumns(input: PracticeTaskRecordInput) {
  return {
    title: input.title,
    instructions: input.instructions,
    due_at: input.dueAt,
    accept_late_submissions: input.acceptLateSubmissions,
    cadence: input.cadence,
    starts_on: input.daily?.startsOn ?? null,
    ends_on: input.daily?.endsOn ?? null,
    weekdays: input.daily?.weekdays ?? null,
    linked_event_id: input.linkedEventId,
    ...practiceTaskReferenceToColumns(input.reference),
  };
}

export function createPracticeTaskRepository(): PracticeTaskRepository {
  async function getById(organizationId: string, taskId: string) {
    const { data, error } = await supabase
      .from('practice_tasks')
      .select(TASK_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('id', taskId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return mapTask(data as unknown as TaskRow);
  }

  return {
    async listVisible(organizationId) {
      const { data, error } = await supabase
        .from('practice_tasks')
        .select(TASK_COLUMNS)
        .eq('organization_id', organizationId)
        .order('due_at', { ascending: true });

      if (error || !data) {
        // Falha não é "nenhuma tarefa": quem chama mostra o erro.
        throw new Error(error?.message ?? 'practice_tasks_list_failed');
      }
      return (data as unknown as TaskRow[]).map(mapTask);
    },

    async listVisibleForFile(organizationId, pieceFileId) {
      const { data, error } = await supabase
        .from('practice_tasks')
        .select(TASK_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('piece_file_id', pieceFileId)
        .order('due_at', { ascending: true });

      if (error || !data) {
        // Falha não é "nenhuma tarefa": quem chama mostra o erro.
        throw new Error(error?.message ?? 'practice_tasks_list_failed');
      }
      return (data as unknown as TaskRow[]).map(mapTask);
    },

    getById,

    async create(organizationId, input) {
      const { data, error } = await supabase
        .from('practice_tasks')
        .insert({ organization_id: organizationId, ...toWriteColumns(input) })
        .select(TASK_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'practice_task_create_failed');
      }
      return mapTask(data as unknown as TaskRow);
    },

    async update(organizationId, taskId, input) {
      const { error } = await supabase
        .from('practice_tasks')
        .update(toWriteColumns(input))
        .eq('organization_id', organizationId)
        .eq('id', taskId);

      if (error) {
        throw new Error(error.message);
      }
      return getById(organizationId, taskId);
    },

    async setAudience(organizationId, taskId, groupIds, musicianIds) {
      const [currentGroups, currentMusicians] = await Promise.all([
        supabase
          .from('practice_task_groups')
          .select('group_id')
          .eq('organization_id', organizationId)
          .eq('task_id', taskId),
        supabase
          .from('practice_task_musicians')
          .select('musician_id')
          .eq('organization_id', organizationId)
          .eq('task_id', taskId),
      ]);
      if (currentGroups.error || currentMusicians.error) {
        throw new Error(
          currentGroups.error?.message ?? currentMusicians.error?.message ?? 'audience_load_failed',
        );
      }

      const existingGroupIds = new Set((currentGroups.data ?? []).map((row) => row.group_id));
      const existingMusicianIds = new Set(
        (currentMusicians.data ?? []).map((row) => row.musician_id),
      );
      const nextGroupIds = new Set(groupIds);
      const nextMusicianIds = new Set(musicianIds);

      const groupsToAdd = groupIds.filter((id) => !existingGroupIds.has(id));
      const groupsToRemove = [...existingGroupIds].filter((id) => !nextGroupIds.has(id));
      const musiciansToAdd = musicianIds.filter((id) => !existingMusicianIds.has(id));
      const musiciansToRemove = [...existingMusicianIds].filter((id) => !nextMusicianIds.has(id));

      // Adiciona antes de remover: em nenhum momento a tarefa fica sem público.
      if (groupsToAdd.length > 0) {
        const { error } = await supabase.from('practice_task_groups').insert(
          groupsToAdd.map((groupId) => ({
            organization_id: organizationId,
            task_id: taskId,
            group_id: groupId,
          })),
        );
        if (error) {
          throw new Error(error.message);
        }
      }
      if (musiciansToAdd.length > 0) {
        const { error } = await supabase.from('practice_task_musicians').insert(
          musiciansToAdd.map((musicianId) => ({
            organization_id: organizationId,
            task_id: taskId,
            musician_id: musicianId,
          })),
        );
        if (error) {
          throw new Error(error.message);
        }
      }
      if (groupsToRemove.length > 0) {
        const { error } = await supabase
          .from('practice_task_groups')
          .delete()
          .eq('organization_id', organizationId)
          .eq('task_id', taskId)
          .in('group_id', groupsToRemove);
        if (error) {
          throw new Error(error.message);
        }
      }
      if (musiciansToRemove.length > 0) {
        const { error } = await supabase
          .from('practice_task_musicians')
          .delete()
          .eq('organization_id', organizationId)
          .eq('task_id', taskId)
          .in('musician_id', musiciansToRemove);
        if (error) {
          throw new Error(error.message);
        }
      }
    },

    async setClosed(organizationId, taskId, closed) {
      const { error } = await supabase
        .from('practice_tasks')
        .update({ closed_at: closed ? new Date().toISOString() : null })
        .eq('organization_id', organizationId)
        .eq('id', taskId);

      if (error) {
        throw new Error(error.message);
      }
      return getById(organizationId, taskId);
    },

    async delete(organizationId, taskId) {
      const { error } = await supabase
        .from('practice_tasks')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', taskId);

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
