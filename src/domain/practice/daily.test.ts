import { describe, expect, it } from 'vitest';
import type { PracticeDailySchedule, PracticeSubmission } from '@/domain/practice';
import {
  listPracticeDailyChargedDays,
  localDateTimeIn,
  practiceDailyOpenDays,
  practiceDailyPeriodFor,
  resolvePracticeDailyProgress,
  resolvePracticeTaskStudentProgress,
  validatePracticeDailySchedule,
  validatePracticeSubmissionReview,
  validatePracticeTaskInput,
} from '@/domain/practice';

const TZ = 'America/Sao_Paulo'; // UTC-3, sem horário de verão

/** Instante a partir do horário de Brasília. */
function brt(local: string): Date {
  return new Date(`${local}-03:00`);
}

// Seg 09/11/2026 a dom 15/11/2026, só dias úteis.
const WEEKDAYS: PracticeDailySchedule = {
  startsOn: '2026-11-09',
  endsOn: '2026-11-15',
  weekdays: [1, 2, 3, 4, 5],
};

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
    periodDate: '2026-11-09',
    submittedAt: '2026-11-09T15:00:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    feedback: null,
    ...overrides,
  };
}

const dailyTask = {
  cadence: 'daily' as const,
  daily: WEEKDAYS,
  timeZone: TZ,
  dueAt: '2026-11-16T02:59:59.000Z',
  closedAt: null,
};

describe('fuso e dias', () => {
  it('usa o dia no fuso da organização, não em UTC', () => {
    // 01:30 UTC de 10/11 ainda é 22:30 de 09/11 em Brasília.
    expect(localDateTimeIn(new Date('2026-11-10T01:30:00Z'), TZ)).toEqual({
      date: '2026-11-09',
      hour: 22,
      minute: 30,
    });
  });

  it('lista só os dias da semana cobrados', () => {
    expect(listPracticeDailyChargedDays(WEEKDAYS)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ]);
  });

  it('valida o período', () => {
    expect(validatePracticeDailySchedule(WEEKDAYS)).toBeNull();
    expect(validatePracticeDailySchedule({ ...WEEKDAYS, endsOn: '2026-11-01' })).toBe(
      'invalid_schedule',
    );
    expect(validatePracticeDailySchedule({ ...WEEKDAYS, weekdays: [] })).toBe('weekdays_required');
    // Só sábado e domingo, num período de seg a sex: nenhum dia cobrado.
    expect(
      validatePracticeDailySchedule({ startsOn: '2026-11-09', endsOn: '2026-11-13', weekdays: [0, 6] }),
    ).toBe('weekdays_required');
    expect(validatePracticeDailySchedule({ ...WEEKDAYS, endsOn: '2028-01-01' })).toBe(
      'schedule_too_long',
    );
  });

  it('exige o período na tarefa diária e dispensa o prazo', () => {
    const base = {
      title: 'Escalas',
      instructions: '',
      reference: { kind: 'none' as const },
      dueAt: '',
      groupIds: [],
      musicianIds: ['m-1'],
    };
    expect(validatePracticeTaskInput({ ...base, cadence: 'daily', daily: WEEKDAYS })).toBeNull();
    expect(validatePracticeTaskInput({ ...base, cadence: 'daily', daily: null })).toBe(
      'invalid_schedule',
    );
    expect(validatePracticeTaskInput(base)).toBe('invalid_due_at');
  });
});

describe('practiceDailyPeriodFor', () => {
  it('conta a gravação de hoje para hoje', () => {
    expect(
      practiceDailyPeriodFor({
        schedule: WEEKDAYS,
        timeZone: TZ,
        recordedAt: brt('2026-11-10T08:00'),
        at: brt('2026-11-10T20:00'),
      }),
    ).toBe('2026-11-10');
  });

  it('recusa gravação de outro dia', () => {
    expect(
      practiceDailyPeriodFor({
        schedule: WEEKDAYS,
        timeZone: TZ,
        recordedAt: brt('2026-11-09T20:00'),
        at: brt('2026-11-10T09:00'),
      }),
    ).toBeNull();
  });

  it('aceita a gravação de ontem até as 02:00', () => {
    const input = { schedule: WEEKDAYS, timeZone: TZ, recordedAt: brt('2026-11-10T23:40') };
    expect(practiceDailyPeriodFor({ ...input, at: brt('2026-11-11T01:59') })).toBe('2026-11-10');
    expect(practiceDailyPeriodFor({ ...input, at: brt('2026-11-11T02:00') })).toBeNull();
  });

  it('recusa dia não cobrado', () => {
    expect(
      practiceDailyPeriodFor({
        schedule: WEEKDAYS,
        timeZone: TZ,
        recordedAt: brt('2026-11-14T10:00'), // sábado
        at: brt('2026-11-14T10:05'),
      }),
    ).toBeNull();
  });

  it('abre ontem e hoje durante a madrugada', () => {
    expect(
      practiceDailyOpenDays({ schedule: WEEKDAYS, timeZone: TZ, now: brt('2026-11-11T01:00') }),
    ).toEqual(['2026-11-10', '2026-11-11']);
    expect(
      practiceDailyOpenDays({ schedule: WEEKDAYS, timeZone: TZ, now: brt('2026-11-14T10:00') }),
    ).toEqual([]);
  });
});

describe('resolvePracticeDailyProgress', () => {
  it('marca entregas, faltas, o dia em aberto e os próximos', () => {
    const progress = resolvePracticeDailyProgress({
      schedule: WEEKDAYS,
      timeZone: TZ,
      deliveredDays: ['2026-11-09', '2026-11-11'],
      closedAt: null,
      now: brt('2026-11-12T10:00'),
    });
    expect(progress.days.map((day) => day.state)).toEqual([
      'delivered',
      'missed',
      'delivered',
      'open',
      'upcoming',
    ]);
    expect(progress).toMatchObject({ delivered: 2, missed: 1, elapsed: 4, streak: 1 });
  });

  it('o dia em aberto não quebra a sequência', () => {
    const progress = resolvePracticeDailyProgress({
      schedule: WEEKDAYS,
      timeZone: TZ,
      deliveredDays: ['2026-11-09', '2026-11-10', '2026-11-11'],
      closedAt: null,
      now: brt('2026-11-12T10:00'),
    });
    expect(progress.streak).toBe(3);
  });

  it('tarefa encerrada: corta o período e não abre dia', () => {
    const progress = resolvePracticeDailyProgress({
      schedule: WEEKDAYS,
      timeZone: TZ,
      deliveredDays: ['2026-11-09'],
      closedAt: brt('2026-11-10T12:00').toISOString(),
      now: brt('2026-11-12T10:00'),
    });
    expect(progress.openDays).toEqual([]);
    expect(progress.days.map((day) => day.state)).toEqual(['delivered', 'missed']);
  });
});

describe('resolvePracticeTaskStudentProgress (diária)', () => {
  it('hoje sem envio: pendente e pode enviar', () => {
    const progress = resolvePracticeTaskStudentProgress({
      task: dailyTask,
      submissions: [submission()],
      now: brt('2026-11-10T10:00'),
    });
    expect(progress).toMatchObject({ status: 'pending', canSubmit: true, blockedReason: null });
  });

  it('revisado hoje: continua podendo enviar', () => {
    const progress = resolvePracticeTaskStudentProgress({
      task: dailyTask,
      submissions: [submission({ periodDate: '2026-11-10', status: 'reviewed' })],
      now: brt('2026-11-10T20:00'),
    });
    expect(progress).toMatchObject({ status: 'reviewed', canSubmit: true });
  });

  it('fim de semana: não é dia de entrega', () => {
    const progress = resolvePracticeTaskStudentProgress({
      task: dailyTask,
      submissions: [submission({ periodDate: '2026-11-13' })],
      now: brt('2026-11-14T10:00'),
    });
    expect(progress).toMatchObject({ canSubmit: false, blockedReason: 'past_due' });
  });

  it('dia não cobrado no meio do período', () => {
    const progress = resolvePracticeTaskStudentProgress({
      task: { ...dailyTask, daily: { ...WEEKDAYS, weekdays: [1, 3, 5] } },
      submissions: [],
      now: brt('2026-11-10T10:00'),
    });
    expect(progress).toMatchObject({ status: 'missed', canSubmit: false, blockedReason: 'not_today' });
  });

  it('antes do início: pendente, sem envio', () => {
    const progress = resolvePracticeTaskStudentProgress({
      task: dailyTask,
      submissions: [],
      now: brt('2026-11-08T10:00'),
    });
    expect(progress).toMatchObject({ status: 'pending', canSubmit: false, blockedReason: 'not_today' });
  });

  it('não pede para refazer em tarefa diária', () => {
    expect(
      validatePracticeSubmissionReview({ status: 'redo_requested', feedback: 'De novo' }, dailyTask),
    ).toBe('redo_not_allowed');
    expect(validatePracticeSubmissionReview({ status: 'reviewed', feedback: null }, dailyTask)).toBeNull();
  });
});
