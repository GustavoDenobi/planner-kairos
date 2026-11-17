import type { PracticeDailySchedule } from './daily';

/**
 * Tarefa de estudo ("tarefa de casa"): o professor ou regente pede que alunos
 * gravem algo até um prazo. Não confundir com `Assignment` (atribuição de músico
 * a uma formação, no contexto ensemble).
 */

/** Onde, dentro de um arquivo de partitura, está o trecho da tarefa. */
export type PracticeTaskLocation =
  | { kind: 'whole_file' }
  | {
      kind: 'toc';
      /** Nulo se o item do sumário foi apagado depois; a cópia abaixo continua valendo. */
      tocEntryId: string | null;
      label: string;
      page: number;
      x: number | null;
      y: number | null;
    }
  | { kind: 'point'; page: number; x: number | null; y: number | null };

/** Vínculo opcional da tarefa com o repertório. */
export type PracticeTaskReference =
  | { kind: 'none' }
  | { kind: 'piece'; pieceId: string }
  | { kind: 'file'; pieceId: string; pieceFileId: string; location: PracticeTaskLocation };

export type PracticeTaskLocationInput =
  | { kind: 'whole_file' }
  | { kind: 'toc'; tocEntryId: string }
  | { kind: 'point'; page: number; x?: number | null; y?: number | null };

export type PracticeTaskReferenceInput =
  | { kind: 'none' }
  | { kind: 'piece'; pieceId: string }
  | {
      kind: 'file';
      pieceId: string;
      pieceFileId: string;
      location: PracticeTaskLocationInput;
    };

/** Entrega única (até um prazo) ou diária (uma gravação por dia cobrado). */
export type PracticeTaskCadence = 'once' | 'daily';

export type PracticeTaskAudienceItem = {
  id: string;
  name: string;
};

export type PracticeTask = {
  id: string;
  organizationId: string;
  createdBy: string | null;
  title: string;
  instructions: string;
  reference: PracticeTaskReference;
  cadence: PracticeTaskCadence;
  /** Só na tarefa diária. */
  daily: PracticeDailySchedule | null;
  /** Fuso da organização: define o "hoje" da tarefa diária. */
  timeZone: string;
  /** Na tarefa diária, o fim do último dia (calculado pelo banco). */
  dueAt: string;
  /** Se falso, o aluno não envia depois do prazo (salvo pedido para refazer). */
  acceptLateSubmissions: boolean;
  linkedEventId: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  groups: PracticeTaskAudienceItem[];
  musicians: PracticeTaskAudienceItem[];
};

export type PracticeTaskInput = {
  title: string;
  instructions: string;
  reference: PracticeTaskReferenceInput;
  /** Padrão: entrega única. */
  cadence?: PracticeTaskCadence;
  /** Obrigatório na tarefa diária. */
  daily?: PracticeDailySchedule | null;
  /** Na tarefa diária é só uma estimativa: o banco recalcula pelo fim do período. */
  dueAt: string;
  /** Padrão: aceita. */
  acceptLateSubmissions?: boolean;
  linkedEventId?: string | null;
  groupIds: string[];
  musicianIds: string[];
};

export const PRACTICE_TASK_TITLE_MAX_LENGTH = 160;
export const PRACTICE_TASK_INSTRUCTIONS_MAX_LENGTH = 4000;

export function isDailyPracticeTask(
  task: Pick<PracticeTask, 'cadence' | 'daily'>,
): task is Pick<PracticeTask, 'cadence'> & { daily: PracticeDailySchedule } {
  return task.cadence === 'daily' && task.daily !== null;
}

export function isPracticeTaskClosed(task: Pick<PracticeTask, 'closedAt'>): boolean {
  return task.closedAt !== null;
}
