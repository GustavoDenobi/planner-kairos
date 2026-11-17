import { describe, expect, it } from 'vitest';
import type { PracticeSubmission, PracticeTaskInput, PracticeTaskReference } from '@/domain/practice';
import {
  buildPracticeSubmissionStoragePath,
  canManagePracticeTask,
  findUnreachablePracticeAudience,
  practiceTaskReferenceFromColumns,
  practiceTaskReferenceStartPage,
  practiceTaskReferenceToColumns,
  resolvePracticeTaskStudentProgress,
  resolvePracticeTaskStudents,
  validatePracticeSubmissionInput,
  validatePracticeSubmissionReview,
  validatePracticeTaskInput,
} from '@/domain/practice';

function input(overrides: Partial<PracticeTaskInput> = {}): PracticeTaskInput {
  return {
    title: 'Escala de Sol',
    instructions: '',
    reference: { kind: 'none' },
    dueAt: '2026-11-06T18:00:00.000Z',
    groupIds: [],
    musicianIds: ['m-1'],
    ...overrides,
  };
}

function submission(overrides: Partial<PracticeSubmission> = {}): PracticeSubmission {
  return {
    id: 's-1',
    organizationId: 'org-1',
    taskId: 't-1',
    musicianId: 'm-1',
    musicianName: 'Ana',
    submittedBy: 'user-ana',
    attempt: 1,
    storagePath: 'org-1/practice/t-1/m-1/s-1.webm',
    mimeType: 'audio/webm',
    durationMs: 60_000,
    byteSize: 1000,
    pageMarks: [],
    studentNote: null,
    status: 'submitted',
    recordedAt: null,
    periodDate: null,
    submittedAt: '2026-11-05T12:00:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    feedback: null,
    ...overrides,
  };
}

describe('validatePracticeTaskInput', () => {
  it('aceita tarefa mínima', () => {
    expect(validatePracticeTaskInput(input())).toBeNull();
  });

  it('exige título, prazo válido e público', () => {
    expect(validatePracticeTaskInput(input({ title: '  ' }))).toBe('title_required');
    expect(validatePracticeTaskInput(input({ dueAt: 'amanhã' }))).toBe('invalid_due_at');
    expect(validatePracticeTaskInput(input({ musicianIds: [], groupIds: [] }))).toBe(
      'audience_required',
    );
  });

  it('valida a posição na partitura', () => {
    const point = (page: number, x: number | null = null) =>
      input({
        reference: {
          kind: 'file',
          pieceId: 'p-1',
          pieceFileId: 'f-1',
          location: { kind: 'point', page, x, y: null },
        },
      });
    expect(validatePracticeTaskInput(point(3, 0.5))).toBeNull();
    expect(validatePracticeTaskInput(point(0))).toBe('invalid_reference');
    expect(validatePracticeTaskInput(point(2, 1.5))).toBe('invalid_reference');
  });
});

describe('referência ↔ colunas', () => {
  const cases: PracticeTaskReference[] = [
    { kind: 'none' },
    { kind: 'piece', pieceId: 'p-1' },
    { kind: 'file', pieceId: 'p-1', pieceFileId: 'f-1', location: { kind: 'whole_file' } },
    {
      kind: 'file',
      pieceId: 'p-1',
      pieceFileId: 'f-1',
      location: { kind: 'point', page: 4, x: 0.2, y: 0.7 },
    },
    {
      kind: 'file',
      pieceId: 'p-1',
      pieceFileId: 'f-1',
      location: { kind: 'toc', tocEntryId: 'toc-1', label: '2º movimento', page: 3, x: null, y: 0.1 },
    },
  ];

  it.each(cases)('ida e volta: %o', (reference) => {
    expect(practiceTaskReferenceFromColumns(practiceTaskReferenceToColumns(reference))).toEqual(
      reference,
    );
  });

  it('item do sumário apagado continua abrindo pela cópia', () => {
    const columns = practiceTaskReferenceToColumns(cases[4]!);
    expect(practiceTaskReferenceFromColumns({ ...columns, toc_entry_id: null })).toEqual({
      kind: 'file',
      pieceId: 'p-1',
      pieceFileId: 'f-1',
      location: { kind: 'toc', tocEntryId: null, label: '2º movimento', page: 3, x: null, y: 0.1 },
    });
  });

  it('arquivo apagado reduz a referência à obra', () => {
    const columns = practiceTaskReferenceToColumns(cases[3]!);
    expect(
      practiceTaskReferenceFromColumns({
        ...columns,
        piece_file_id: null,
        target_page: null,
        target_x: null,
        target_y: null,
      }),
    ).toEqual({ kind: 'piece', pieceId: 'p-1' });
  });

  it('página inicial do leitor', () => {
    expect(practiceTaskReferenceStartPage(cases[0]!)).toBeNull();
    expect(practiceTaskReferenceStartPage(cases[2]!)).toBe(1);
    expect(practiceTaskReferenceStartPage(cases[3]!)).toBe(4);
  });
});

describe('permissões', () => {
  const teacher = {
    isPrivileged: false,
    isGroupWriter: true,
    writableGroupIds: ['g-1'],
    musicianGroupIdsByMusicianId: { 'm-1': ['g-1'], 'm-2': ['g-2'] },
  };

  it('professor só alcança os próprios grupos e seus alunos', () => {
    expect(
      findUnreachablePracticeAudience({ context: teacher, groupIds: ['g-1'], musicianIds: ['m-1'] }),
    ).toBeNull();
    expect(
      findUnreachablePracticeAudience({ context: teacher, groupIds: ['g-2'], musicianIds: [] }),
    ).toEqual({ kind: 'group', id: 'g-2' });
    expect(
      findUnreachablePracticeAudience({ context: teacher, groupIds: [], musicianIds: ['m-2'] }),
    ).toEqual({ kind: 'musician', id: 'm-2' });
  });

  it('admin alcança qualquer público', () => {
    expect(
      findUnreachablePracticeAudience({
        context: { ...teacher, isPrivileged: true, isGroupWriter: false, writableGroupIds: [] },
        groupIds: ['g-9'],
        musicianIds: ['m-9'],
      }),
    ).toBeNull();
  });

  it('professor gerencia tarefa que criou ou de grupo em que atua', () => {
    const task = { createdBy: 'other', groups: [{ id: 'g-1', name: 'Turma' }] };
    expect(canManagePracticeTask({ context: teacher, userId: 'me', task })).toBe(true);
    expect(
      canManagePracticeTask({ context: teacher, userId: 'me', task: { ...task, groups: [] } }),
    ).toBe(false);
    expect(
      canManagePracticeTask({
        context: teacher,
        userId: 'me',
        task: { createdBy: 'me', groups: [] },
      }),
    ).toBe(true);
    expect(
      canManagePracticeTask({
        context: { ...teacher, isGroupWriter: false, writableGroupIds: [] },
        userId: 'me',
        task: { createdBy: 'me', groups: [] },
      }),
    ).toBe(false);
  });
});

describe('resolvePracticeTaskStudents', () => {
  it('une músicos diretos e membros dos grupos, sem os professores', () => {
    expect(
      resolvePracticeTaskStudents({
        groupIds: ['g-1'],
        directMusicians: [{ musicianId: 'm-3', musicianName: 'Carla' }],
        groupMembers: [
          { musicianId: 'm-1', musicianName: 'Bruno', groupId: 'g-1', ensembleRole: 'member' },
          { musicianId: 't-1', musicianName: 'Prof', groupId: 'g-1', ensembleRole: 'teacher' },
          { musicianId: 'm-2', musicianName: 'Ana', groupId: 'g-1', ensembleRole: 'section_lead' },
          { musicianId: 'm-9', musicianName: 'Zé', groupId: 'g-2', ensembleRole: 'member' },
        ],
      }).map((student) => student.musicianName),
    ).toEqual(['Ana', 'Bruno', 'Carla']);
  });
});

describe('resolvePracticeTaskStudentProgress', () => {
  const task = { dueAt: '2026-11-06T18:00:00.000Z', closedAt: null };
  const before = new Date('2026-11-05T00:00:00.000Z');
  const after = new Date('2026-11-07T00:00:00.000Z');

  it('sem envio: pendente, atrasado ou perdido', () => {
    expect(resolvePracticeTaskStudentProgress({ task, submissions: [], now: before })).toMatchObject({
      status: 'pending',
      canSubmit: true,
    });
    expect(resolvePracticeTaskStudentProgress({ task, submissions: [], now: after })).toMatchObject({
      status: 'late',
      canSubmit: true,
    });
    expect(
      resolvePracticeTaskStudentProgress({
        task: { ...task, closedAt: '2026-11-08T00:00:00.000Z' },
        submissions: [],
        now: after,
      }),
    ).toMatchObject({ status: 'missed', canSubmit: false });
  });

  it('usa a última tentativa e marca envio atrasado', () => {
    const progress = resolvePracticeTaskStudentProgress({
      task,
      submissions: [
        submission({ attempt: 1, status: 'redo_requested' }),
        submission({ id: 's-2', attempt: 2, submittedAt: '2026-11-06T19:00:00.000Z' }),
      ],
      now: after,
    });
    expect(progress.status).toBe('submitted');
    expect(progress.latestSubmission?.id).toBe('s-2');
    expect(progress.submittedLate).toBe(true);
    expect(progress.canSubmit).toBe(true);
  });

  it('sem envios atrasados: perde o prazo, salvo pedido para refazer', () => {
    const strict = { ...task, acceptLateSubmissions: false };
    expect(resolvePracticeTaskStudentProgress({ task: strict, submissions: [], now: before })).toMatchObject({
      status: 'pending',
      canSubmit: true,
      blockedReason: null,
    });
    expect(resolvePracticeTaskStudentProgress({ task: strict, submissions: [], now: after })).toMatchObject({
      status: 'missed',
      canSubmit: false,
      blockedReason: 'past_due',
    });
    expect(
      resolvePracticeTaskStudentProgress({ task: strict, submissions: [submission()], now: after }),
    ).toMatchObject({ status: 'submitted', canSubmit: false, blockedReason: 'past_due' });
    expect(
      resolvePracticeTaskStudentProgress({
        task: strict,
        submissions: [submission({ status: 'redo_requested' })],
        now: after,
      }),
    ).toMatchObject({ status: 'redo_requested', canSubmit: true, blockedReason: null });
  });

  it('depois de revisado não aceita novo envio', () => {
    expect(
      resolvePracticeTaskStudentProgress({
        task,
        submissions: [submission({ status: 'reviewed' })],
        now: before,
      }).canSubmit,
    ).toBe(false);
  });
});

describe('envio e revisão', () => {
  it('valida a gravação enviada', () => {
    expect(
      validatePracticeSubmissionInput({ byteSize: 10, mimeType: 'audio/webm;codecs=opus', studentNote: null }),
    ).toBeNull();
    expect(validatePracticeSubmissionInput({ byteSize: 0, mimeType: 'audio/webm', studentNote: null })).toBe(
      'empty_recording',
    );
    expect(validatePracticeSubmissionInput({ byteSize: 10, mimeType: 'video/mp4', studentNote: null })).toBe(
      'unsupported_format',
    );
  });

  it('pedir para refazer exige comentário', () => {
    expect(validatePracticeSubmissionReview({ status: 'redo_requested', feedback: ' ' })).toBe(
      'feedback_required',
    );
    expect(validatePracticeSubmissionReview({ status: 'reviewed', feedback: null })).toBeNull();
  });

  it('monta o caminho que as policies de storage esperam', () => {
    expect(
      buildPracticeSubmissionStoragePath({
        organizationId: 'org-1',
        taskId: 't-1',
        musicianId: 'm-1',
        submissionId: 's-1',
        mimeType: 'audio/mp4',
      }),
    ).toBe('org-1/practice/t-1/m-1/s-1.m4a');
  });
});
