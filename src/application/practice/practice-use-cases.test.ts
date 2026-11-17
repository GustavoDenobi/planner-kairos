import { describe, expect, it, vi } from 'vitest';
import type { PracticeDeps, PracticeAccessContext } from '@/application/practice/practice-deps';
import {
  reviewPracticeSubmission,
  submitPracticeRecording,
} from '@/application/practice/submission-use-cases';
import {
  createPracticeTask,
  deletePracticeTask,
  listAssignedPracticeTasks,
  listPracticeTasks,
} from '@/application/practice/task-use-cases';
import type {
  PracticeSubmission,
  PracticeTask,
  PracticeTaskInput,
  PracticeTaskReference,
} from '@/domain/practice';
import type { EnsembleRole } from '@/domain/ensemble';
import { Result } from '@/domain/shared';

const ORG = 'org-1';
const NOW = new Date('2026-11-04T12:00:00.000Z');

const TEACHER: PracticeAccessContext = {
  isPrivileged: false,
  isGroupWriter: true,
  writableGroupIds: ['class-1'],
  memberGroupIds: ['class-1'],
  myMusicianId: 'teacher-m',
  musicianGroupIdsByMusicianId: { 'student-1': ['class-1'], 'student-2': ['class-1'] },
};

const STUDENT: PracticeAccessContext = {
  isPrivileged: false,
  isGroupWriter: false,
  writableGroupIds: [],
  memberGroupIds: ['class-1'],
  myMusicianId: 'student-1',
  musicianGroupIdsByMusicianId: {},
};

const GROUP_MEMBERS: Array<{ musicianId: string; musicianName: string; ensembleRole: EnsembleRole }> = [
  { musicianId: 'teacher-m', musicianName: 'Prof', ensembleRole: 'teacher' },
  { musicianId: 'student-1', musicianName: 'Ana', ensembleRole: 'member' },
  { musicianId: 'student-2', musicianName: 'Bruno', ensembleRole: 'member' },
];

function taskInput(overrides: Partial<PracticeTaskInput> = {}): PracticeTaskInput {
  return {
    title: 'Escala',
    instructions: '',
    reference: { kind: 'none' },
    dueAt: '2026-11-06T18:00:00.000Z',
    groupIds: ['class-1'],
    musicianIds: [],
    ...overrides,
  };
}

function submission(overrides: Partial<PracticeSubmission> = {}): PracticeSubmission {
  return {
    id: 'sub-1',
    organizationId: ORG,
    taskId: 'task-1',
    musicianId: 'student-1',
    musicianName: 'Ana',
    submittedBy: 'user-ana',
    attempt: 1,
    storagePath: `${ORG}/practice/task-1/student-1/sub-1.webm`,
    mimeType: 'audio/webm',
    durationMs: 1000,
    byteSize: 10,
    pageMarks: [],
    studentNote: null,
    status: 'submitted',
    recordedAt: null,
    periodDate: null,
    submittedAt: '2026-11-04T10:00:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    feedback: null,
    ...overrides,
  };
}

function createDeps(options: {
  context: PracticeAccessContext;
  tasks?: PracticeTask[];
  submissions?: PracticeSubmission[];
  failAudience?: boolean;
  failSubmissionCreate?: boolean;
}) {
  const tasks = [...(options.tasks ?? [])];
  const submissions = [...(options.submissions ?? [])];
  const calls: string[] = [];
  let idCounter = 0;

  const deps: PracticeDeps = {
    loadContext: async () => Result.ok(options.context),
    newId: () => `id-${++idCounter}`,
    now: () => NOW,
    taskRepo: {
      listVisible: async () => tasks,
      listVisibleForFile: async (_org, fileId) =>
        tasks.filter(
          (task) => task.reference.kind === 'file' && task.reference.pieceFileId === fileId,
        ),
      getById: async (_org, taskId) => tasks.find((task) => task.id === taskId) ?? null,
      create: async (_org, input) => {
        const task: PracticeTask = {
          id: `task-${tasks.length + 1}`,
          organizationId: ORG,
          createdBy: 'user-teacher',
          title: input.title,
          instructions: input.instructions,
          reference: input.reference,
          cadence: input.cadence,
          daily: input.daily,
          timeZone: 'America/Sao_Paulo',
          dueAt: input.dueAt,
          acceptLateSubmissions: input.acceptLateSubmissions,
          linkedEventId: input.linkedEventId,
          closedAt: null,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          groups: [],
          musicians: [],
        };
        tasks.push(task);
        return task;
      },
      update: vi.fn(),
      setAudience: async (_org, taskId, groupIds, musicianIds) => {
        if (options.failAudience) {
          throw new Error('rls');
        }
        const task = tasks.find((item) => item.id === taskId)!;
        task.groups = groupIds.map((id) => ({ id, name: id }));
        task.musicians = musicianIds.map((id) => ({ id, name: id }));
      },
      setClosed: vi.fn(),
      delete: async (_org, taskId) => {
        calls.push(`delete-task:${taskId}`);
        const index = tasks.findIndex((task) => task.id === taskId);
        tasks.splice(index, 1);
      },
    },
    submissionRepo: {
      listForTask: async (_org, taskId) => submissions.filter((row) => row.taskId === taskId),
      listForTasks: async (_org, taskIds) => submissions.filter((row) => taskIds.includes(row.taskId)),
      getById: async (_org, id) => submissions.find((row) => row.id === id) ?? null,
      create: async (_org, input) => {
        if (options.failSubmissionCreate) {
          throw new Error('rls');
        }
        const created = submission({ ...input, submittedAt: NOW.toISOString() });
        submissions.push(created);
        return created;
      },
      review: async (_org, id, input) => {
        const row = submissions.find((item) => item.id === id)!;
        Object.assign(row, input);
        return row;
      },
      delete: vi.fn(),
    },
    assignmentRepo: {
      listForGroup: async (_org, groupId) =>
        GROUP_MEMBERS.map((member) => ({
          id: `a-${member.musicianId}`,
          organizationId: ORG,
          groupId,
          sectionId: null,
          partId: null,
          groupName: 'Turma',
          sectionName: null,
          partName: null,
          musicianPhone: null,
          ...member,
        })),
    },
    pieceRepo: { getById: vi.fn() },
    pieceFileRepo: {
      getById: async (_org, pieceId, fileId) =>
        pieceId === 'piece-1' && fileId === 'file-1' ? ({ id: fileId } as never) : null,
    },
    tocRepo: {
      listForFile: async () => [
        {
          id: 'toc-1',
          organizationId: ORG,
          pieceFileId: 'file-1',
          label: '2º movimento',
          sortOrder: 0,
          targetPageNumber: 3,
          targetX: null,
          targetY: 0.4,
          endPageNumber: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
    },
    fileStorage: {
      uploadPracticeRecording: async (path) => {
        calls.push(`upload:${path}`);
      },
      remove: async (path) => {
        calls.push(`remove:${path}`);
      },
      getSignedUrl: async (path) => `https://signed/${path}`,
    },
  };

  return { deps, tasks, submissions, calls };
}

function existingTask(overrides: Partial<PracticeTask> = {}): PracticeTask {
  return {
    id: 'task-1',
    organizationId: ORG,
    createdBy: 'user-teacher',
    title: 'Escala',
    instructions: '',
    reference: { kind: 'none' },
    cadence: 'once',
    daily: null,
    timeZone: 'America/Sao_Paulo',
    dueAt: '2026-11-06T18:00:00.000Z',
    acceptLateSubmissions: true,
    linkedEventId: null,
    closedAt: null,
    createdAt: '',
    updatedAt: '',
    groups: [{ id: 'class-1', name: 'Turma' }],
    musicians: [],
    ...overrides,
  };
}

describe('createPracticeTask', () => {
  it('professor cria tarefa para a própria turma, com trecho do sumário', async () => {
    const { deps } = createDeps({ context: TEACHER });
    const result = await createPracticeTask(
      deps,
      ORG,
      'user-teacher',
      taskInput({
        reference: {
          kind: 'file',
          pieceId: 'piece-1',
          pieceFileId: 'file-1',
          location: { kind: 'toc', tocEntryId: 'toc-1' },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.groups.map((group) => group.id)).toEqual(['class-1']);
      expect(result.value.reference).toEqual<PracticeTaskReference>({
        kind: 'file',
        pieceId: 'piece-1',
        pieceFileId: 'file-1',
        location: { kind: 'toc', tocEntryId: 'toc-1', label: '2º movimento', page: 3, x: null, y: 0.4 },
      });
    }
  });

  it('recusa público fora do alcance do professor', async () => {
    const { deps } = createDeps({ context: TEACHER });
    expect(await createPracticeTask(deps, ORG, 'u', taskInput({ groupIds: ['class-9'] }))).toEqual(
      Result.fail('audience_not_allowed'),
    );
  });

  it('aluno não cria tarefa', async () => {
    const { deps } = createDeps({ context: STUDENT });
    expect(await createPracticeTask(deps, ORG, 'u', taskInput())).toEqual(Result.fail('not_allowed'));
  });

  it('referência inválida não é gravada', async () => {
    const { deps, tasks } = createDeps({ context: TEACHER });
    const result = await createPracticeTask(
      deps,
      ORG,
      'u',
      taskInput({
        reference: {
          kind: 'file',
          pieceId: 'piece-1',
          pieceFileId: 'file-1',
          location: { kind: 'toc', tocEntryId: 'toc-x' },
        },
      }),
    );
    expect(result).toEqual(Result.fail('invalid_reference'));
    expect(tasks).toHaveLength(0);
  });

  it('desfaz a tarefa se o público não puder ser gravado', async () => {
    const { deps, tasks } = createDeps({ context: TEACHER, failAudience: true });
    expect(await createPracticeTask(deps, ORG, 'u', taskInput())).toEqual(Result.fail('save_failed'));
    expect(tasks).toHaveLength(0);
  });
});

describe('listPracticeTasks', () => {
  it('professor vê contagem por aluno (sem contar o professor)', async () => {
    const { deps } = createDeps({
      context: TEACHER,
      tasks: [existingTask()],
      submissions: [submission()],
    });
    const result = await listPracticeTasks(deps, ORG, 'user-teacher');
    expect(result.ok && result.value.managed[0]?.counts).toEqual({
      students: 2,
      pending: 1,
      submitted: 1,
      reviewed: 0,
      redoRequested: 0,
    });
    expect(result.ok && result.value.assigned).toEqual([]);
  });

  it('aluno vê a tarefa com o próprio status', async () => {
    const { deps } = createDeps({ context: STUDENT, tasks: [existingTask()] });
    const result = await listPracticeTasks(deps, ORG, 'user-ana');
    expect(result.ok && result.value.canCreate).toBe(false);
    expect(result.ok && result.value.assigned[0]?.progress.status).toBe('pending');
  });
});

describe('listAssignedPracticeTasks', () => {
  it('professor não recebe as tarefas que passou', async () => {
    const { deps } = createDeps({ context: TEACHER, tasks: [existingTask()] });
    expect(await listAssignedPracticeTasks(deps, ORG, 'user-teacher')).toEqual(Result.ok([]));
  });

  it('aluno recebe as próprias tarefas com o status', async () => {
    const { deps } = createDeps({
      context: STUDENT,
      tasks: [existingTask()],
      submissions: [submission()],
    });
    const result = await listAssignedPracticeTasks(deps, ORG, 'user-ana');
    expect(result.ok && result.value.map((item) => item.progress.status)).toEqual(['submitted']);
  });
});

describe('submitPracticeRecording', () => {
  const recording = {
    blob: new Blob(['abc'], { type: 'audio/webm' }),
    mimeType: 'audio/webm',
    durationMs: 1500,
    pageMarks: [{ atSec: 0, pieceFileId: 'file-1', page: 3 }],
    studentNote: '  primeira tentativa ',
    recordedAt: '2026-11-04T09:58:00.000Z',
  };

  it('envia nova tentativa para o caminho da tarefa', async () => {
    const { deps, calls } = createDeps({
      context: STUDENT,
      tasks: [existingTask()],
      submissions: [submission({ status: 'redo_requested', feedback: 'Mais devagar' })],
    });
    const result = await submitPracticeRecording(deps, ORG, 'user-ana', 'task-1', recording);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.attempt).toBe(2);
      expect(result.value.studentNote).toBe('primeira tentativa');
      expect(result.value.storagePath).toBe(`${ORG}/practice/task-1/student-1/id-1.webm`);
    }
    expect(calls).toEqual([`upload:${ORG}/practice/task-1/student-1/id-1.webm`]);
  });

  it('quem não é aluno da tarefa não envia', async () => {
    const { deps } = createDeps({ context: TEACHER, tasks: [existingTask()] });
    expect(await submitPracticeRecording(deps, ORG, 'u', 'task-1', recording)).toEqual(
      Result.fail('not_a_student'),
    );
  });

  it('não envia depois de revisado nem com a tarefa encerrada', async () => {
    const reviewed = createDeps({
      context: STUDENT,
      tasks: [existingTask()],
      submissions: [submission({ status: 'reviewed' })],
    });
    expect(await submitPracticeRecording(reviewed.deps, ORG, 'u', 'task-1', recording)).toEqual(
      Result.fail('already_reviewed'),
    );

    const closed = createDeps({
      context: STUDENT,
      tasks: [existingTask({ closedAt: '2026-11-04T00:00:00.000Z' })],
    });
    expect(await submitPracticeRecording(closed.deps, ORG, 'u', 'task-1', recording)).toEqual(
      Result.fail('task_closed'),
    );
  });

  describe('tarefa diária', () => {
    // NOW = qua 04/11, 09:00 em Brasília.
    const daily = () =>
      existingTask({
        cadence: 'daily',
        daily: { startsOn: '2026-11-02', endsOn: '2026-11-08', weekdays: [0, 1, 2, 3, 4, 5, 6] },
        dueAt: '2026-11-09T02:59:59.000Z',
        acceptLateSubmissions: false,
      });

    it('revisão de ontem não impede a entrega de hoje', async () => {
      const { deps } = createDeps({
        context: STUDENT,
        tasks: [daily()],
        submissions: [submission({ status: 'reviewed', periodDate: '2026-11-03' })],
      });
      const result = await submitPracticeRecording(deps, ORG, 'u', 'task-1', recording);
      expect(result.ok).toBe(true);
    });

    it('recusa gravação feita em outro dia', async () => {
      const { deps, calls } = createDeps({ context: STUDENT, tasks: [daily()] });
      expect(
        await submitPracticeRecording(deps, ORG, 'u', 'task-1', {
          ...recording,
          recordedAt: '2026-11-03T20:00:00.000Z', // ter 03/11, 17:00 em Brasília
        }),
      ).toEqual(Result.fail('recording_not_from_today'));
      expect(calls).toEqual([]);
    });

    it('não pede para refazer', async () => {
      const { deps } = createDeps({
        context: TEACHER,
        tasks: [daily()],
        submissions: [submission({ periodDate: '2026-11-04' })],
      });
      expect(
        await reviewPracticeSubmission(deps, ORG, 'user-teacher', 'sub-1', {
          status: 'redo_requested',
          feedback: 'De novo',
        }),
      ).toEqual(Result.fail('redo_not_allowed'));
    });
  });

  it('recusa envio atrasado quando a tarefa não aceita', async () => {
    const { deps, calls } = createDeps({
      context: STUDENT,
      tasks: [existingTask({ dueAt: '2026-11-01T18:00:00.000Z', acceptLateSubmissions: false })],
    });
    expect(await submitPracticeRecording(deps, ORG, 'u', 'task-1', recording)).toEqual(
      Result.fail('past_due'),
    );
    expect(calls).toEqual([]);
  });

  it('remove o arquivo se o registro do envio falhar', async () => {
    const { deps, calls } = createDeps({
      context: STUDENT,
      tasks: [existingTask()],
      failSubmissionCreate: true,
    });
    expect(await submitPracticeRecording(deps, ORG, 'u', 'task-1', recording)).toEqual(
      Result.fail('save_failed'),
    );
    expect(calls).toEqual([
      `upload:${ORG}/practice/task-1/student-1/id-1.webm`,
      `remove:${ORG}/practice/task-1/student-1/id-1.webm`,
    ]);
  });
});

describe('reviewPracticeSubmission', () => {
  it('professor revisa; pedir para refazer exige comentário', async () => {
    const { deps } = createDeps({
      context: TEACHER,
      tasks: [existingTask()],
      submissions: [submission()],
    });
    expect(
      await reviewPracticeSubmission(deps, ORG, 'user-teacher', 'sub-1', {
        status: 'redo_requested',
        feedback: '',
      }),
    ).toEqual(Result.fail('feedback_required'));

    const result = await reviewPracticeSubmission(deps, ORG, 'user-teacher', 'sub-1', {
      status: 'reviewed',
      feedback: ' Muito bem ',
    });
    expect(result.ok && result.value.feedback).toBe('Muito bem');
  });

  it('aluno não revisa', async () => {
    const { deps } = createDeps({
      context: STUDENT,
      tasks: [existingTask()],
      submissions: [submission()],
    });
    expect(
      await reviewPracticeSubmission(deps, ORG, 'user-ana', 'sub-1', { status: 'reviewed', feedback: null }),
    ).toEqual(Result.fail('not_allowed'));
  });
});

describe('deletePracticeTask', () => {
  it('apaga os arquivos antes da tarefa', async () => {
    const { deps, calls } = createDeps({
      context: TEACHER,
      tasks: [existingTask()],
      submissions: [submission()],
    });
    expect(await deletePracticeTask(deps, ORG, 'user-teacher', 'task-1')).toEqual(Result.ok(undefined));
    expect(calls).toEqual([`remove:${ORG}/practice/task-1/student-1/sub-1.webm`, 'delete-task:task-1']);
  });
});
