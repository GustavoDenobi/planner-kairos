import type {
  PracticeSubmission,
  PracticeSubmissionPageMark,
  PracticeSubmissionReviewInput,
  PracticeSubmissionValidationError,
} from '@/domain/practice';
import {
  buildPracticeSubmissionStoragePath,
  canManagePracticeTask,
  isDailyPracticeTask,
  latestPracticeSubmission,
  practiceDailyPeriodFor,
  resolvePracticeTaskStudentProgress,
  validatePracticeSubmissionInput,
  validatePracticeSubmissionReview,
} from '@/domain/practice';
import { Result } from '@/domain/shared';
import { studentGroupIds, type PracticeDeps } from './practice-deps';

export type SubmitPracticeRecordingInput = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  pageMarks: PracticeSubmissionPageMark[];
  studentNote: string | null;
  /** Quando a gravação foi feita: só gravações feitas dentro da tarefa são enviadas. */
  recordedAt: string;
};

export type SubmitPracticeRecordingError =
  | PracticeSubmissionValidationError
  | 'not_a_member'
  | 'not_found'
  | 'not_a_student'
  | 'task_closed'
  | 'already_reviewed'
  | 'past_due'
  /** Tarefa diária: hoje não é dia de entrega. */
  | 'not_a_delivery_day'
  /** Tarefa diária: a gravação não é do dia que está aberto. */
  | 'recording_not_from_today'
  | 'upload_failed'
  | 'save_failed';

/** Envia uma gravação local como nova tentativa do aluno na tarefa. */
export async function submitPracticeRecording(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  taskId: string,
  input: SubmitPracticeRecordingInput,
): Promise<Result<PracticeSubmission, SubmitPracticeRecordingError>> {
  const validationError = validatePracticeSubmissionInput({
    byteSize: input.blob.size,
    mimeType: input.mimeType,
    studentNote: input.studentNote,
  });
  if (validationError) {
    return Result.fail(validationError);
  }

  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }
  const context = contextResult.value;

  const task = await deps.taskRepo.getById(organizationId, taskId);
  if (!task) {
    return Result.fail('not_found');
  }

  const musicianId = context.myMusicianId;
  const groups = studentGroupIds(context);
  const isStudent =
    musicianId !== null &&
    (task.musicians.some((musician) => musician.id === musicianId) ||
      task.groups.some((group) => groups.has(group.id)));
  if (!musicianId || !isStudent) {
    return Result.fail('not_a_student');
  }

  const own = (await deps.submissionRepo.listForTask(organizationId, taskId)).filter(
    (row) => row.musicianId === musicianId,
  );
  const now = deps.now();
  const progress = resolvePracticeTaskStudentProgress({ task, submissions: own, now });
  if (!progress.canSubmit) {
    const reason = progress.blockedReason;
    return Result.fail(
      reason === 'closed'
        ? 'task_closed'
        : reason === 'past_due'
          ? 'past_due'
          : reason === 'not_today'
            ? 'not_a_delivery_day'
            : 'already_reviewed',
    );
  }
  // Tarefa diária: só vale a gravação do próprio dia (a de ontem, até a madrugada).
  if (
    isDailyPracticeTask(task) &&
    practiceDailyPeriodFor({
      schedule: task.daily,
      timeZone: task.timeZone,
      recordedAt: new Date(input.recordedAt),
      at: now,
    }) === null
  ) {
    return Result.fail('recording_not_from_today');
  }

  const submissionId = deps.newId();
  const storagePath = buildPracticeSubmissionStoragePath({
    organizationId,
    taskId,
    musicianId,
    submissionId,
    mimeType: input.mimeType,
  });

  try {
    await deps.fileStorage.uploadPracticeRecording(storagePath, input.blob, input.mimeType);
  } catch {
    return Result.fail('upload_failed');
  }

  try {
    const note = input.studentNote?.trim() || null;
    const created = await deps.submissionRepo.create(organizationId, {
      id: submissionId,
      taskId,
      musicianId,
      attempt: (latestPracticeSubmission(own)?.attempt ?? 0) + 1,
      storagePath,
      mimeType: input.mimeType,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      byteSize: input.blob.size,
      pageMarks: input.pageMarks,
      studentNote: note,
      recordedAt: input.recordedAt,
    });
    return Result.ok(created);
  } catch {
    // Sem a linha no banco o arquivo ficaria órfão (e contando no armazenamento).
    await deps.fileStorage.remove(storagePath).catch(() => undefined);
    return Result.fail('save_failed');
  }
}

export async function reviewPracticeSubmission(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  submissionId: string,
  input: PracticeSubmissionReviewInput,
): Promise<
  Result<
    PracticeSubmission,
    | 'not_a_member'
    | 'not_found'
    | 'not_allowed'
    | 'feedback_too_long'
    | 'feedback_required'
    | 'redo_not_allowed'
    | 'save_failed'
  >
> {
  const inputError = validatePracticeSubmissionReview(input);
  if (inputError) {
    return Result.fail(inputError);
  }

  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }

  const submission = await deps.submissionRepo.getById(organizationId, submissionId);
  if (!submission) {
    return Result.fail('not_found');
  }
  const task = await deps.taskRepo.getById(organizationId, submission.taskId);
  if (!task) {
    return Result.fail('not_found');
  }
  if (!canManagePracticeTask({ context: contextResult.value, userId, task })) {
    return Result.fail('not_allowed');
  }
  const taskError = validatePracticeSubmissionReview(input, task);
  if (taskError) {
    return Result.fail(taskError);
  }

  try {
    const saved = await deps.submissionRepo.review(organizationId, submissionId, {
      status: input.status,
      feedback: input.feedback?.trim() || null,
    });
    return saved ? Result.ok(saved) : Result.fail('not_found');
  } catch {
    return Result.fail('save_failed');
  }
}

/** O aluno desiste de um envio que ainda não foi revisado. */
export async function withdrawPracticeSubmission(
  deps: PracticeDeps,
  organizationId: string,
  userId: string,
  submissionId: string,
): Promise<Result<void, 'not_a_member' | 'not_found' | 'not_allowed' | 'delete_failed'>> {
  const contextResult = await deps.loadContext(organizationId, userId);
  if (!contextResult.ok) {
    return contextResult;
  }

  const submission = await deps.submissionRepo.getById(organizationId, submissionId);
  if (!submission) {
    return Result.fail('not_found');
  }
  if (
    submission.musicianId !== contextResult.value.myMusicianId ||
    submission.status !== 'submitted'
  ) {
    return Result.fail('not_allowed');
  }

  try {
    await deps.submissionRepo.delete(organizationId, submissionId);
  } catch {
    return Result.fail('delete_failed');
  }
  await deps.fileStorage.remove(submission.storagePath).catch(() => undefined);
  return Result.ok(undefined);
}

/** URL temporária para ouvir um envio (o storage confere a permissão). */
export async function getPracticeSubmissionAudioUrl(
  deps: PracticeDeps,
  organizationId: string,
  submissionId: string,
): Promise<Result<string, 'not_found' | 'url_failed'>> {
  const submission = await deps.submissionRepo.getById(organizationId, submissionId);
  if (!submission) {
    return Result.fail('not_found');
  }
  try {
    return Result.ok(await deps.fileStorage.getSignedUrl(submission.storagePath, 60 * 60));
  } catch {
    return Result.fail('url_failed');
  }
}
