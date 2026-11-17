import type {
  PracticeSubmission,
  PracticeTask,
  PracticeTaskStudent,
  PracticeTaskStudentProgress,
  PracticeTaskStudentStatus,
} from '@/domain/practice';
import {
  canCreatePracticeTasks,
  canManagePracticeTask,
  resolvePracticeTaskStudentProgress,
  resolvePracticeTaskStudents,
} from '@/domain/practice';
import { Result } from '@/domain/shared';
import type { PracticeDeps } from './practice-deps';
import { loadPracticeTaskStudents, sortPracticeTaskItems } from './task-use-cases';

export type PracticeStudentTaskItem = {
  task: PracticeTask;
  progress: PracticeTaskStudentProgress;
  /** Envios do aluno nesta tarefa, da tentativa mais recente para a mais antiga. */
  submissions: PracticeSubmission[];
};

export type PracticeStudentOverview = PracticeTaskStudent & {
  items: PracticeStudentTaskItem[];
};

export type PracticeStudentsOverview = {
  canCreate: boolean;
  students: PracticeStudentOverview[];
};

/** Público a consultar: os grupos e músicos de um evento, ou um músico só. */
export type PracticeOverviewAudience = {
  groupIds: string[];
  musicians: PracticeTaskStudent[];
};

/**
 * Tarefas que o usuário gerencia, por aluno do público: base da cobrança na aula
 * (aba Tarefas do evento) e do histórico no cadastro do aluno.
 */
export async function listPracticeStudentsOverview(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  audience: PracticeOverviewAudience,
): Promise<Result<PracticeStudentsOverview, 'not_a_member' | 'load_failed'>> {
  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }
  const context = contextResult.value;

  try {
    const groupRows = await Promise.all(
      audience.groupIds.map((groupId) => deps.assignmentRepo.listForGroup(organizationId, groupId)),
    );
    const students = resolvePracticeTaskStudents({
      groupIds: audience.groupIds,
      directMusicians: audience.musicians,
      groupMembers: groupRows.flat().map((row) => ({
        musicianId: row.musicianId,
        musicianName: row.musicianName,
        groupId: row.groupId,
        ensembleRole: row.ensembleRole,
      })),
    });
    const studentIds = new Set(students.map((student) => student.musicianId));

    const tasks = (await deps.taskRepo.listVisible(organizationId)).filter((task) =>
      canManagePracticeTask({ context, userId, task }),
    );
    const withStudents = await Promise.all(
      tasks.map(async (task) => ({
        task,
        studentIds: new Set(
          (await loadPracticeTaskStudents(deps, organizationId, task))
            .map((student) => student.musicianId)
            .filter((id) => studentIds.has(id)),
        ),
      })),
    );
    const relevant = withStudents.filter((entry) => entry.studentIds.size > 0);
    const submissions =
      relevant.length > 0
        ? await deps.submissionRepo.listForTasks(
            organizationId,
            relevant.map((entry) => entry.task.id),
          )
        : [];

    const now = deps.now();
    return Result.ok({
      canCreate: canCreatePracticeTasks(context),
      students: students.map((student) => {
        const items = relevant
          .filter((entry) => entry.studentIds.has(student.musicianId))
          .map(({ task }) => {
            const own = submissions
              .filter((row) => row.taskId === task.id && row.musicianId === student.musicianId)
              .sort((a, b) => b.attempt - a.attempt);
            return {
              task,
              submissions: own,
              progress: resolvePracticeTaskStudentProgress({ task, submissions: own, now }),
            };
          });
        return { ...student, items: sortPracticeTaskItems(items, now) };
      }),
    });
  } catch {
    return Result.fail('load_failed');
  }
}

// ---------------------------------------------------------------------------
// Resumo para a aula
// ---------------------------------------------------------------------------

/** O que o professor faz com a tarefa diante do aluno. */
export type PracticeLessonAttention = 'collect' | 'listen' | 'ongoing' | 'done';

export function practiceLessonAttention(status: PracticeTaskStudentStatus): PracticeLessonAttention {
  switch (status) {
    case 'late':
    case 'missed':
    case 'redo_requested':
      return 'collect';
    case 'submitted':
      return 'listen';
    case 'pending':
      return 'ongoing';
    default:
      return 'done';
  }
}

const ATTENTION_RANK: Record<PracticeLessonAttention, number> = {
  collect: 0,
  listen: 1,
  ongoing: 2,
  done: 3,
};

export type PracticeLessonStudentSummary = PracticeStudentOverview & {
  counts: Record<PracticeLessonAttention, number>;
};

/**
 * Visão da aula: só tarefas abertas (e envios encerrados ainda sem ouvir), com o
 * que cobrar primeiro; alunos com algo a cobrar ou ouvir vêm antes.
 */
export function summarizePracticeLesson(
  students: readonly PracticeStudentOverview[],
): PracticeLessonStudentSummary[] {
  const summaries = students.map((student) => {
    const items = student.items
      .filter((item) => item.task.closedAt === null || item.progress.status === 'submitted')
      .sort(
        (a, b) =>
          ATTENTION_RANK[practiceLessonAttention(a.progress.status)] -
            ATTENTION_RANK[practiceLessonAttention(b.progress.status)] ||
          a.task.dueAt.localeCompare(b.task.dueAt),
      );
    const counts: Record<PracticeLessonAttention, number> = {
      collect: 0,
      listen: 0,
      ongoing: 0,
      done: 0,
    };
    for (const item of items) {
      counts[practiceLessonAttention(item.progress.status)] += 1;
    }
    return { ...student, items, counts };
  });

  const studentRank = (summary: PracticeLessonStudentSummary) =>
    summary.counts.collect > 0 ? 0 : summary.counts.listen > 0 ? 1 : 2;
  return summaries.sort(
    (a, b) =>
      studentRank(a) - studentRank(b) ||
      a.musicianName.localeCompare(b.musicianName, 'pt-BR', { sensitivity: 'base' }),
  );
}
