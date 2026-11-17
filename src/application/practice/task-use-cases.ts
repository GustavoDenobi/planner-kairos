import type {
  PracticeSubmission,
  PracticeTask,
  PracticeTaskInput,
  PracticeTaskReference,
  PracticeTaskReferenceInput,
  PracticeTaskStudent,
  PracticeTaskStudentProgress,
  PracticeTaskValidationError,
} from '@/domain/practice';
import {
  canCreatePracticeTasks,
  canManagePracticeTask,
  findUnreachablePracticeAudience,
  normalizePracticeTaskInput,
  resolvePracticeTaskStudentProgress,
  resolvePracticeTaskStudents,
  validatePracticeTaskInput,
} from '@/domain/practice';
import { Result } from '@/domain/shared';
import {
  studentGroupIds,
  type PracticeAccessContext,
  type PracticeDeps,
} from './practice-deps';

export type PracticeTaskWriteError =
  | PracticeTaskValidationError
  | 'not_a_member'
  | 'not_allowed'
  | 'audience_not_allowed'
  | 'not_found'
  | 'save_failed';

export type PracticeStudentRow = PracticeTaskStudent & {
  progress: PracticeTaskStudentProgress;
  submissions: PracticeSubmission[];
};

export type PracticeTaskCounts = {
  students: number;
  pending: number;
  submitted: number;
  reviewed: number;
  redoRequested: number;
};

export type ManagedPracticeTaskItem = {
  task: PracticeTask;
  counts: PracticeTaskCounts;
};

export type AssignedPracticeTaskItem = {
  task: PracticeTask;
  progress: PracticeTaskStudentProgress;
};

export type PracticeTaskList = {
  canCreate: boolean;
  managed: ManagedPracticeTaskItem[];
  assigned: AssignedPracticeTaskItem[];
};

export type PracticeTaskDetail = {
  task: PracticeTask;
  canManage: boolean;
  /** Só para quem gerencia a tarefa. */
  students: PracticeStudentRow[];
  /** Só para aluno da tarefa. */
  mine: { musicianId: string; progress: PracticeTaskStudentProgress; submissions: PracticeSubmission[] } | null;
};

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function isStudentOf(task: PracticeTask, context: PracticeAccessContext): boolean {
  if (!context.myMusicianId) {
    return false;
  }
  if (task.musicians.some((musician) => musician.id === context.myMusicianId)) {
    return true;
  }
  const groups = studentGroupIds(context);
  return task.groups.some((group) => groups.has(group.id));
}

async function resolveReference(
  deps: PracticeDeps,
  organizationId: string,
  input: PracticeTaskReferenceInput,
): Promise<PracticeTaskReference | null> {
  if (input.kind === 'none') {
    return { kind: 'none' };
  }

  if (input.kind === 'piece') {
    const piece = await deps.pieceRepo.getById(organizationId, input.pieceId);
    return piece ? { kind: 'piece', pieceId: input.pieceId } : null;
  }

  const file = await deps.pieceFileRepo.getById(organizationId, input.pieceId, input.pieceFileId);
  if (!file) {
    return null;
  }

  const location = input.location;
  if (location.kind === 'whole_file') {
    return { ...input, location: { kind: 'whole_file' } };
  }
  if (location.kind === 'point') {
    return {
      ...input,
      location: { kind: 'point', page: location.page, x: location.x ?? null, y: location.y ?? null },
    };
  }

  const entries = await deps.tocRepo.listForFile(organizationId, input.pieceFileId);
  const entry = entries.find((item) => item.id === location.tocEntryId);
  if (!entry) {
    return null;
  }
  return {
    ...input,
    location: {
      kind: 'toc',
      tocEntryId: entry.id,
      label: entry.label,
      page: entry.targetPageNumber,
      x: entry.targetX,
      y: entry.targetY,
    },
  };
}

/** Alunos da tarefa (grupos + indicados diretamente), sem os professores dos grupos. */
export async function loadPracticeTaskStudents(
  deps: PracticeDeps,
  organizationId: string,
  task: PracticeTask,
): Promise<PracticeTaskStudent[]> {
  const groupRows = await Promise.all(
    task.groups.map((group) => deps.assignmentRepo.listForGroup(organizationId, group.id)),
  );
  return resolvePracticeTaskStudents({
    groupIds: task.groups.map((group) => group.id),
    directMusicians: task.musicians.map((musician) => ({
      musicianId: musician.id,
      musicianName: musician.name,
    })),
    groupMembers: groupRows.flat().map((row) => ({
      musicianId: row.musicianId,
      musicianName: row.musicianName,
      groupId: row.groupId,
      ensembleRole: row.ensembleRole,
    })),
  });
}

function groupByMusician(submissions: PracticeSubmission[]): Map<string, PracticeSubmission[]> {
  const byMusician = new Map<string, PracticeSubmission[]>();
  for (const submission of submissions) {
    const list = byMusician.get(submission.musicianId) ?? [];
    list.push(submission);
    byMusician.set(submission.musicianId, list);
  }
  for (const list of byMusician.values()) {
    list.sort((a, b) => b.attempt - a.attempt);
  }
  return byMusician;
}

function buildStudentRows(
  task: PracticeTask,
  students: PracticeTaskStudent[],
  submissions: PracticeSubmission[],
  now: Date,
): PracticeStudentRow[] {
  const byMusician = groupByMusician(submissions.filter((row) => row.taskId === task.id));
  return students.map((student) => {
    const own = byMusician.get(student.musicianId) ?? [];
    return {
      ...student,
      submissions: own,
      progress: resolvePracticeTaskStudentProgress({ task, submissions: own, now }),
    };
  });
}

export function countPracticeTaskStudents(rows: PracticeStudentRow[]): PracticeTaskCounts {
  const counts: PracticeTaskCounts = {
    students: rows.length,
    pending: 0,
    submitted: 0,
    reviewed: 0,
    redoRequested: 0,
  };
  for (const row of rows) {
    switch (row.progress.status) {
      case 'submitted':
        counts.submitted += 1;
        break;
      case 'reviewed':
        counts.reviewed += 1;
        break;
      case 'redo_requested':
        counts.redoRequested += 1;
        break;
      default:
        counts.pending += 1;
    }
  }
  return counts;
}

/**
 * Em andamento primeiro (prazo mais próximo no topo), depois as de prazo vencido
 * (a que venceu por último primeiro) e por fim as encerradas (a mais recente primeiro).
 */
export function sortPracticeTaskItems<T extends { task: PracticeTask }>(items: T[], now: Date): T[] {
  const nowMs = now.getTime();
  const bucket = (task: PracticeTask) =>
    task.closedAt !== null ? 2 : new Date(task.dueAt).getTime() < nowMs ? 1 : 0;
  return items.sort((a, b) => {
    const bucketA = bucket(a.task);
    const bucketB = bucket(b.task);
    if (bucketA !== bucketB) {
      return bucketA - bucketB;
    }
    const byDue = a.task.dueAt.localeCompare(b.task.dueAt);
    return bucketA === 0 ? byDue : -byDue;
  });
}

async function prepareWrite(
  deps: PracticeDeps,
  organizationId: string,
  context: PracticeAccessContext,
  rawInput: PracticeTaskInput,
): Promise<Result<{ input: PracticeTaskInput; reference: PracticeTaskReference }, PracticeTaskWriteError>> {
  const input = normalizePracticeTaskInput(rawInput);
  const validationError = validatePracticeTaskInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  if (
    findUnreachablePracticeAudience({
      context,
      groupIds: input.groupIds,
      musicianIds: input.musicianIds,
    })
  ) {
    return Result.fail('audience_not_allowed');
  }

  const reference = await resolveReference(deps, organizationId, input.reference);
  if (!reference) {
    return Result.fail('invalid_reference');
  }

  return Result.ok({ input, reference });
}

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

async function buildPracticeTaskList(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  context: PracticeAccessContext,
  tasks: PracticeTask[],
): Promise<PracticeTaskList> {
  const now = deps.now();
  const managedTasks = tasks.filter((task) => canManagePracticeTask({ context, userId, task }));
  const managedIds = new Set(managedTasks.map((task) => task.id));
  const assignedTasks = tasks.filter(
    (task) => !managedIds.has(task.id) && isStudentOf(task, context),
  );

  const submissions = await deps.submissionRepo.listForTasks(
    organizationId,
    tasks.map((task) => task.id),
  );

  const managed = await Promise.all(
    managedTasks.map(async (task) => {
      const students = await loadPracticeTaskStudents(deps, organizationId, task);
      return {
        task,
        counts: countPracticeTaskStudents(buildStudentRows(task, students, submissions, now)),
      };
    }),
  );

  const mine = submissions.filter((row) => row.musicianId === context.myMusicianId);
  const assigned = assignedTasks.map((task) => ({
    task,
    progress: resolvePracticeTaskStudentProgress({
      task,
      submissions: mine.filter((row) => row.taskId === task.id),
      now,
    }),
  }));

  return {
    canCreate: canCreatePracticeTasks(context),
    managed: sortPracticeTaskItems(managed, now),
    assigned: sortPracticeTaskItems(assigned, now),
  };
}

export async function listPracticeTasks(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
): Promise<Result<PracticeTaskList, 'not_a_member' | 'load_failed'>> {
  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }
  try {
    const tasks = await deps.taskRepo.listVisible(organizationId);
    return Result.ok(
      await buildPracticeTaskList(deps, organizationId, userId, contextResult.value, tasks),
    );
  } catch {
    return Result.fail('load_failed');
  }
}

/**
 * Só as tarefas de que o usuário é destinatário, com o andamento dele (para a agenda).
 * Não carrega os alunos das tarefas que ele gerencia.
 */
export async function listAssignedPracticeTasks(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
): Promise<Result<AssignedPracticeTaskItem[], 'not_a_member' | 'load_failed'>> {
  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }
  const context = contextResult.value;
  if (!context.myMusicianId) {
    return Result.ok([]);
  }
  try {
    const tasks = (await deps.taskRepo.listVisible(organizationId)).filter(
      (task) => !canManagePracticeTask({ context, userId, task }) && isStudentOf(task, context),
    );
    if (tasks.length === 0) {
      return Result.ok([]);
    }
    const now = deps.now();
    const mine = (
      await deps.submissionRepo.listForTasks(
        organizationId,
        tasks.map((task) => task.id),
      )
    ).filter((row) => row.musicianId === context.myMusicianId);
    return Result.ok(
      tasks.map((task) => ({
        task,
        progress: resolvePracticeTaskStudentProgress({
          task,
          submissions: mine.filter((row) => row.taskId === task.id),
          now,
        }),
      })),
    );
  } catch {
    return Result.fail('load_failed');
  }
}

/** Tarefas ligadas a um arquivo (para o leitor de partituras). */
export async function listPracticeTasksForFile(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  pieceFileId: string,
): Promise<Result<PracticeTaskList, 'not_a_member' | 'load_failed'>> {
  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }
  try {
    const tasks = await deps.taskRepo.listVisibleForFile(organizationId, pieceFileId);
    return Result.ok(
      await buildPracticeTaskList(deps, organizationId, userId, contextResult.value, tasks),
    );
  } catch {
    return Result.fail('load_failed');
  }
}

export async function getPracticeTaskDetail(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  taskId: string,
): Promise<Result<PracticeTaskDetail, 'not_a_member' | 'not_found'>> {
  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }
  const context = contextResult.value;

  const task = await deps.taskRepo.getById(organizationId, taskId);
  if (!task) {
    return Result.fail('not_found');
  }

  const now = deps.now();
  const canManage = canManagePracticeTask({ context, userId, task });
  const submissions = await deps.submissionRepo.listForTask(organizationId, taskId);

  const students = canManage
    ? buildStudentRows(task, await loadPracticeTaskStudents(deps, organizationId, task), submissions, now)
    : [];

  let mine: PracticeTaskDetail['mine'] = null;
  if (context.myMusicianId && isStudentOf(task, context)) {
    const own = submissions
      .filter((row) => row.musicianId === context.myMusicianId)
      .sort((a, b) => b.attempt - a.attempt);
    mine = {
      musicianId: context.myMusicianId,
      submissions: own,
      progress: resolvePracticeTaskStudentProgress({ task, submissions: own, now }),
    };
  }

  return Result.ok({ task, canManage, students, mine });
}

export async function createPracticeTask(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  rawInput: PracticeTaskInput,
): Promise<Result<PracticeTask, PracticeTaskWriteError>> {
  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }
  const context = contextResult.value;
  if (!canCreatePracticeTasks(context)) {
    return Result.fail('not_allowed');
  }

  const prepared = await prepareWrite(deps, organizationId, context, rawInput);
  if (!prepared.ok) {
    return prepared;
  }
  const { input, reference } = prepared.value;

  let task: PracticeTask;
  try {
    task = await deps.taskRepo.create(organizationId, {
      title: input.title,
      instructions: input.instructions,
      reference,
      cadence: input.cadence ?? 'once',
      daily: input.daily ?? null,
      dueAt: input.dueAt,
      acceptLateSubmissions: input.acceptLateSubmissions ?? true,
      linkedEventId: input.linkedEventId ?? null,
    });
  } catch {
    return Result.fail('save_failed');
  }

  try {
    await deps.taskRepo.setAudience(organizationId, task.id, input.groupIds, input.musicianIds);
  } catch {
    // Sem público a tarefa ficaria invisível para os alunos: desfaz.
    await deps.taskRepo.delete(organizationId, task.id).catch(() => undefined);
    return Result.fail('save_failed');
  }

  const saved = await deps.taskRepo.getById(organizationId, task.id);
  return saved ? Result.ok(saved) : Result.fail('save_failed');
}

async function loadManagedTask(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  taskId: string,
): Promise<
  Result<{ task: PracticeTask; context: PracticeAccessContext }, 'not_a_member' | 'not_found' | 'not_allowed'>
> {
  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }
  const context = contextResult.value;
  const task = await deps.taskRepo.getById(organizationId, taskId);
  if (!task) {
    return Result.fail('not_found');
  }
  if (!canManagePracticeTask({ context, userId, task })) {
    return Result.fail('not_allowed');
  }
  return Result.ok({ task, context });
}

export async function updatePracticeTask(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  taskId: string,
  rawInput: PracticeTaskInput,
): Promise<Result<PracticeTask, PracticeTaskWriteError>> {
  const loaded = await loadManagedTask(deps, organizationId, userId, taskId);
  if (!loaded.ok) {
    return loaded;
  }

  const prepared = await prepareWrite(deps, organizationId, loaded.value.context, rawInput);
  if (!prepared.ok) {
    return prepared;
  }
  const { input, reference } = prepared.value;

  try {
    await deps.taskRepo.update(organizationId, taskId, {
      title: input.title,
      instructions: input.instructions,
      reference,
      cadence: input.cadence ?? 'once',
      daily: input.daily ?? null,
      dueAt: input.dueAt,
      acceptLateSubmissions: input.acceptLateSubmissions ?? true,
      linkedEventId: input.linkedEventId ?? null,
    });
    await deps.taskRepo.setAudience(organizationId, taskId, input.groupIds, input.musicianIds);
  } catch {
    return Result.fail('save_failed');
  }

  const saved = await deps.taskRepo.getById(organizationId, taskId);
  return saved ? Result.ok(saved) : Result.fail('not_found');
}

export async function setPracticeTaskClosed(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  taskId: string,
  closed: boolean,
): Promise<Result<PracticeTask, 'not_a_member' | 'not_found' | 'not_allowed' | 'save_failed'>> {
  const loaded = await loadManagedTask(deps, organizationId, userId, taskId);
  if (!loaded.ok) {
    return loaded;
  }
  try {
    const saved = await deps.taskRepo.setClosed(organizationId, taskId, closed);
    return saved ? Result.ok(saved) : Result.fail('not_found');
  } catch {
    return Result.fail('save_failed');
  }
}

/**
 * Exclui a tarefa e os arquivos das gravações enviadas. Os arquivos saem primeiro:
 * a permissão de apagá-los depende de a tarefa ainda existir.
 */
export async function deletePracticeTask(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  taskId: string,
): Promise<Result<void, 'not_a_member' | 'not_found' | 'not_allowed' | 'delete_failed'>> {
  const loaded = await loadManagedTask(deps, organizationId, userId, taskId);
  if (!loaded.ok) {
    return loaded;
  }

  const submissions = await deps.submissionRepo.listForTask(organizationId, taskId);
  await Promise.all(
    submissions.map((submission) =>
      deps.fileStorage.remove(submission.storagePath).catch(() => undefined),
    ),
  );

  try {
    await deps.taskRepo.delete(organizationId, taskId);
  } catch {
    return Result.fail('delete_failed');
  }
  return Result.ok(undefined);
}
