import { isGroupWriterRole, type EnsembleRole } from '@/domain/ensemble';
import {
  DEFAULT_ORGANIZATION_TIME_ZONE,
  normalizePracticeDailySchedule,
  resolvePracticeDailyProgress,
  validatePracticeDailySchedule,
  type PracticeDailyProgress,
  type PracticeDailyScheduleError,
} from './daily';
import {
  PRACTICE_TASK_INSTRUCTIONS_MAX_LENGTH,
  PRACTICE_TASK_TITLE_MAX_LENGTH,
  type PracticeTask,
  type PracticeTaskInput,
  type PracticeTaskLocation,
  type PracticeTaskReference,
} from './practice-task';
import {
  PRACTICE_SUBMISSION_FEEDBACK_MAX_LENGTH,
  PRACTICE_SUBMISSION_MAX_BYTES,
  PRACTICE_SUBMISSION_NOTE_MAX_LENGTH,
  isAllowedPracticeSubmissionMimeType,
  type PracticeSubmission,
  type PracticeSubmissionReviewInput,
} from './practice-submission';

// ---------------------------------------------------------------------------
// Validação da tarefa
// ---------------------------------------------------------------------------

export type PracticeTaskValidationError =
  | 'title_required'
  | 'title_too_long'
  | 'instructions_too_long'
  | 'invalid_due_at'
  | 'audience_required'
  | 'invalid_reference'
  | PracticeDailyScheduleError;

function isNormalizedCoord(value: number | null | undefined): boolean {
  return value === null || value === undefined || (Number.isFinite(value) && value >= 0 && value <= 1);
}

export function normalizePracticeTaskInput(input: PracticeTaskInput): PracticeTaskInput {
  return {
    ...input,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    cadence: input.cadence ?? 'once',
    daily:
      input.cadence === 'daily' && input.daily ? normalizePracticeDailySchedule(input.daily) : null,
    linkedEventId: input.linkedEventId ?? null,
    groupIds: [...new Set(input.groupIds)],
    musicianIds: [...new Set(input.musicianIds)],
  };
}

export function validatePracticeTaskInput(
  input: PracticeTaskInput,
): PracticeTaskValidationError | null {
  const title = input.title.trim();
  if (!title) {
    return 'title_required';
  }
  if (title.length > PRACTICE_TASK_TITLE_MAX_LENGTH) {
    return 'title_too_long';
  }
  if (input.instructions.trim().length > PRACTICE_TASK_INSTRUCTIONS_MAX_LENGTH) {
    return 'instructions_too_long';
  }
  if (input.cadence === 'daily') {
    if (!input.daily) {
      return 'invalid_schedule';
    }
    const scheduleError = validatePracticeDailySchedule(input.daily);
    if (scheduleError) {
      return scheduleError;
    }
  } else if (Number.isNaN(Date.parse(input.dueAt))) {
    return 'invalid_due_at';
  }
  if (input.groupIds.length === 0 && input.musicianIds.length === 0) {
    return 'audience_required';
  }

  const reference = input.reference;
  if (reference.kind === 'piece' && !reference.pieceId) {
    return 'invalid_reference';
  }
  if (reference.kind === 'file') {
    if (!reference.pieceId || !reference.pieceFileId) {
      return 'invalid_reference';
    }
    const location = reference.location;
    if (location.kind === 'toc' && !location.tocEntryId) {
      return 'invalid_reference';
    }
    if (location.kind === 'point') {
      if (!Number.isInteger(location.page) || location.page < 1) {
        return 'invalid_reference';
      }
      if (!isNormalizedCoord(location.x) || !isNormalizedCoord(location.y)) {
        return 'invalid_reference';
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Referência ↔ colunas
// ---------------------------------------------------------------------------

/** Colunas de `practice_tasks` que guardam a referência. */
export type PracticeTaskReferenceColumns = {
  piece_id: string | null;
  piece_file_id: string | null;
  toc_entry_id: string | null;
  toc_label_snapshot: string | null;
  target_page: number | null;
  target_x: number | null;
  target_y: number | null;
};

const EMPTY_REFERENCE_COLUMNS: PracticeTaskReferenceColumns = {
  piece_id: null,
  piece_file_id: null,
  toc_entry_id: null,
  toc_label_snapshot: null,
  target_page: null,
  target_x: null,
  target_y: null,
};

export function practiceTaskReferenceToColumns(
  reference: PracticeTaskReference,
): PracticeTaskReferenceColumns {
  if (reference.kind === 'none') {
    return { ...EMPTY_REFERENCE_COLUMNS };
  }
  if (reference.kind === 'piece') {
    return { ...EMPTY_REFERENCE_COLUMNS, piece_id: reference.pieceId };
  }

  const base = {
    ...EMPTY_REFERENCE_COLUMNS,
    piece_id: reference.pieceId,
    piece_file_id: reference.pieceFileId,
  };
  const location = reference.location;
  if (location.kind === 'whole_file') {
    return base;
  }
  if (location.kind === 'toc') {
    return {
      ...base,
      toc_entry_id: location.tocEntryId,
      toc_label_snapshot: location.label,
      target_page: location.page,
      target_x: location.x,
      target_y: location.y,
    };
  }
  return {
    ...base,
    target_page: location.page,
    target_x: location.x,
    target_y: location.y,
  };
}

/**
 * Lê a referência das colunas. Se o arquivo foi apagado, a tarefa fica só com a obra;
 * se a obra foi apagada, fica sem referência.
 */
export function practiceTaskReferenceFromColumns(
  columns: PracticeTaskReferenceColumns,
): PracticeTaskReference {
  if (!columns.piece_id) {
    return { kind: 'none' };
  }
  if (!columns.piece_file_id) {
    return { kind: 'piece', pieceId: columns.piece_id };
  }

  let location: PracticeTaskLocation;
  if (columns.toc_label_snapshot !== null && columns.target_page !== null) {
    location = {
      kind: 'toc',
      tocEntryId: columns.toc_entry_id,
      label: columns.toc_label_snapshot,
      page: columns.target_page,
      x: columns.target_x,
      y: columns.target_y,
    };
  } else if (columns.target_page !== null) {
    location = {
      kind: 'point',
      page: columns.target_page,
      x: columns.target_x,
      y: columns.target_y,
    };
  } else {
    location = { kind: 'whole_file' };
  }

  return {
    kind: 'file',
    pieceId: columns.piece_id,
    pieceFileId: columns.piece_file_id,
    location,
  };
}

/** Página em que o leitor deve abrir para esta referência (1 se não houver posição). */
export function practiceTaskReferenceStartPage(reference: PracticeTaskReference): number | null {
  if (reference.kind !== 'file') {
    return null;
  }
  return reference.location.kind === 'whole_file' ? 1 : reference.location.page;
}

// ---------------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------------

export type PracticeWriterContext = {
  isPrivileged: boolean;
  isGroupWriter: boolean;
  writableGroupIds: string[];
  /** Grupos de cada músico alcançável pelo professor/regente (grupos em que ele escreve). */
  musicianGroupIdsByMusicianId: Record<string, string[]>;
};

/** Admin cria para qualquer público; professor/regente, só para os grupos em que atua. */
export function canCreatePracticeTasks(context: PracticeWriterContext): boolean {
  return context.isPrivileged || context.isGroupWriter;
}

export function canManagePracticeTask(input: {
  context: PracticeWriterContext;
  userId: string;
  task: Pick<PracticeTask, 'createdBy' | 'groups'>;
}): boolean {
  const { context, userId, task } = input;
  if (context.isPrivileged) {
    return true;
  }
  if (!context.isGroupWriter) {
    return false;
  }
  if (task.createdBy === userId) {
    return true;
  }
  const writable = new Set(context.writableGroupIds);
  return task.groups.some((group) => writable.has(group.id));
}

/** Retorna o primeiro alvo fora do alcance do usuário, ou null se todos são permitidos. */
export function findUnreachablePracticeAudience(input: {
  context: PracticeWriterContext;
  groupIds: string[];
  musicianIds: string[];
}): { kind: 'group' | 'musician'; id: string } | null {
  const { context } = input;
  if (context.isPrivileged) {
    return null;
  }
  const writable = new Set(context.writableGroupIds);
  for (const groupId of input.groupIds) {
    if (!writable.has(groupId)) {
      return { kind: 'group', id: groupId };
    }
  }
  for (const musicianId of input.musicianIds) {
    const groups = context.musicianGroupIdsByMusicianId[musicianId] ?? [];
    if (!groups.some((groupId) => writable.has(groupId))) {
      return { kind: 'musician', id: musicianId };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Público da tarefa (alunos)
// ---------------------------------------------------------------------------

export type PracticeGroupMemberRow = {
  musicianId: string;
  musicianName: string;
  groupId: string;
  ensembleRole: EnsembleRole;
};

export type PracticeTaskStudent = {
  musicianId: string;
  musicianName: string;
};

/**
 * Alunos de uma tarefa: músicos indicados diretamente mais os membros dos grupos.
 * Professores e regentes dos grupos não entram (a não ser que indicados diretamente).
 */
export function resolvePracticeTaskStudents(input: {
  groupIds: string[];
  directMusicians: PracticeTaskStudent[];
  groupMembers: PracticeGroupMemberRow[];
}): PracticeTaskStudent[] {
  const byId = new Map<string, PracticeTaskStudent>();
  for (const musician of input.directMusicians) {
    byId.set(musician.musicianId, musician);
  }

  const groupIds = new Set(input.groupIds);
  const writerIds = new Set(
    input.groupMembers
      .filter((row) => groupIds.has(row.groupId) && isGroupWriterRole(row.ensembleRole))
      .map((row) => row.musicianId),
  );

  for (const row of input.groupMembers) {
    if (!groupIds.has(row.groupId) || writerIds.has(row.musicianId) || byId.has(row.musicianId)) {
      continue;
    }
    byId.set(row.musicianId, { musicianId: row.musicianId, musicianName: row.musicianName });
  }

  return [...byId.values()].sort((a, b) =>
    a.musicianName.localeCompare(b.musicianName, 'pt-BR', { sensitivity: 'base' }),
  );
}

// ---------------------------------------------------------------------------
// Status do aluno na tarefa
// ---------------------------------------------------------------------------

export type PracticeTaskStudentStatus =
  | 'pending'
  | 'late'
  | 'missed'
  | 'submitted'
  | 'reviewed'
  | 'redo_requested';

/** `not_today`: tarefa diária fora de um dia de entrega (antes do início ou dia não cobrado). */
export type PracticeSubmitBlockReason = 'closed' | 'reviewed' | 'past_due' | 'not_today';

export type PracticeTaskStudentProgress = {
  status: PracticeTaskStudentStatus;
  latestSubmission: PracticeSubmission | null;
  submittedLate: boolean;
  canSubmit: boolean;
  /** Por que o aluno não pode enviar (null se pode). */
  blockedReason: PracticeSubmitBlockReason | null;
  /** Só na tarefa diária: situação de cada dia. */
  daily: PracticeDailyProgress | null;
};

type ProgressTask = Pick<PracticeTask, 'dueAt' | 'closedAt'> &
  Partial<Pick<PracticeTask, 'acceptLateSubmissions' | 'cadence' | 'daily' | 'timeZone'>>;

export function latestPracticeSubmission(
  submissions: readonly PracticeSubmission[],
): PracticeSubmission | null {
  let latest: PracticeSubmission | null = null;
  for (const submission of submissions) {
    if (!latest || submission.attempt > latest.attempt) {
      latest = submission;
    }
  }
  return latest;
}

/**
 * Status derivado (não gravado) de um aluno numa tarefa.
 * Depois do prazo, o envio depende de `acceptLateSubmissions`; um pedido para
 * refazer sempre permite reenviar enquanto a tarefa estiver aberta.
 * Mesma regra de `can_submit_practice_task` no banco.
 */
export function resolvePracticeTaskStudentProgress(input: {
  task: ProgressTask;
  submissions: readonly PracticeSubmission[];
  now: Date;
}): PracticeTaskStudentProgress {
  if (input.task.cadence === 'daily' && input.task.daily) {
    return resolveDailyStudentProgress({ ...input, schedule: input.task.daily });
  }
  const isClosed = input.task.closedAt !== null;
  const acceptLate = input.task.acceptLateSubmissions ?? true;
  const dueAtMs = Date.parse(input.task.dueAt);
  const pastDue = input.now.getTime() > dueAtMs;
  const latest = latestPracticeSubmission(input.submissions);

  let blockedReason: PracticeSubmitBlockReason | null = null;
  if (isClosed) {
    blockedReason = 'closed';
  } else if (latest?.status === 'reviewed') {
    blockedReason = 'reviewed';
  } else if (pastDue && !acceptLate && latest?.status !== 'redo_requested') {
    blockedReason = 'past_due';
  }

  if (!latest) {
    return {
      status: isClosed || blockedReason === 'past_due' ? 'missed' : pastDue ? 'late' : 'pending',
      latestSubmission: null,
      submittedLate: false,
      canSubmit: blockedReason === null,
      blockedReason,
      daily: null,
    };
  }

  return {
    status: latest.status,
    latestSubmission: latest,
    submittedLate: Date.parse(latest.submittedAt) > dueAtMs,
    canSubmit: blockedReason === null,
    blockedReason,
    daily: null,
  };
}

/**
 * Tarefa diária: o status é o do dia em aberto (enviada/revisada se já entregou,
 * pendente se não). Fora de um dia de entrega, vale o último envio; sem nenhum
 * envio, "pendente" antes do primeiro dia e "não entregue" depois.
 * Revisão não bloqueia: no dia seguinte o aluno entrega de novo.
 */
function resolveDailyStudentProgress(input: {
  task: ProgressTask;
  schedule: NonNullable<PracticeTask['daily']>;
  submissions: readonly PracticeSubmission[];
  now: Date;
}): PracticeTaskStudentProgress {
  const daily = resolvePracticeDailyProgress({
    schedule: input.schedule,
    timeZone: input.task.timeZone ?? DEFAULT_ORGANIZATION_TIME_ZONE,
    deliveredDays: input.submissions.flatMap((row) => (row.periodDate ? [row.periodDate] : [])),
    closedAt: input.task.closedAt,
    now: input.now,
  });
  const latest = latestPracticeSubmission(input.submissions);

  let blockedReason: PracticeSubmitBlockReason | null = null;
  if (input.task.closedAt !== null) {
    blockedReason = 'closed';
  } else if (daily.openDays.length === 0) {
    // Sem nenhum dia cobrado pela frente, o período acabou (mesmo antes de ends_on).
    blockedReason = daily.days.some((day) => day.state === 'upcoming') ? 'not_today' : 'past_due';
  }

  // Dia em aberto mais recente (normalmente hoje).
  const openDay = blockedReason === null ? (daily.openDays[daily.openDays.length - 1] ?? null) : null;
  let status: PracticeTaskStudentStatus;
  if (openDay !== null) {
    const ofDay = latestPracticeSubmission(
      input.submissions.filter((row) => row.periodDate === openDay),
    );
    status = ofDay ? dailySubmissionStatus(ofDay) : 'pending';
  } else if (latest) {
    status = dailySubmissionStatus(latest);
  } else {
    status = daily.elapsed === 0 ? 'pending' : 'missed';
  }

  return {
    status,
    latestSubmission: latest,
    submittedLate: false,
    canSubmit: blockedReason === null,
    blockedReason,
    daily,
  };
}

/** Na tarefa diária não existe "refazer"; um envio marcado assim conta como enviado. */
function dailySubmissionStatus(submission: PracticeSubmission): PracticeTaskStudentStatus {
  return submission.status === 'redo_requested' ? 'submitted' : submission.status;
}

// ---------------------------------------------------------------------------
// Envio e revisão
// ---------------------------------------------------------------------------

export type PracticeSubmissionValidationError =
  | 'empty_recording'
  | 'recording_too_large'
  | 'unsupported_format'
  | 'note_too_long';

export function validatePracticeSubmissionInput(input: {
  byteSize: number;
  mimeType: string;
  studentNote: string | null;
}): PracticeSubmissionValidationError | null {
  if (input.byteSize <= 0) {
    return 'empty_recording';
  }
  if (input.byteSize > PRACTICE_SUBMISSION_MAX_BYTES) {
    return 'recording_too_large';
  }
  if (!isAllowedPracticeSubmissionMimeType(input.mimeType)) {
    return 'unsupported_format';
  }
  if ((input.studentNote?.trim().length ?? 0) > PRACTICE_SUBMISSION_NOTE_MAX_LENGTH) {
    return 'note_too_long';
  }
  return null;
}

export function validatePracticeSubmissionReview(
  input: PracticeSubmissionReviewInput,
  task?: Pick<PracticeTask, 'cadence'>,
): 'feedback_too_long' | 'feedback_required' | 'redo_not_allowed' | null {
  const feedback = input.feedback?.trim() ?? '';
  if (feedback.length > PRACTICE_SUBMISSION_FEEDBACK_MAX_LENGTH) {
    return 'feedback_too_long';
  }
  // Na tarefa diária o aluno entrega de novo no dia seguinte: não há o que refazer.
  if (input.status === 'redo_requested' && task?.cadence === 'daily') {
    return 'redo_not_allowed';
  }
  // Pedir para refazer sem dizer o quê deixa o aluno sem rumo.
  if (input.status === 'redo_requested' && !feedback) {
    return 'feedback_required';
  }
  return null;
}
