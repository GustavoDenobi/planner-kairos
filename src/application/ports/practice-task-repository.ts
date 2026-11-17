import type {
  PracticeDailySchedule,
  PracticeTask,
  PracticeTaskCadence,
  PracticeTaskReference,
} from '@/domain/practice';

export type PracticeTaskRecordInput = {
  title: string;
  instructions: string;
  reference: PracticeTaskReference;
  cadence: PracticeTaskCadence;
  daily: PracticeDailySchedule | null;
  /** Na tarefa diária o banco recalcula pelo fim do período. */
  dueAt: string;
  acceptLateSubmissions: boolean;
  linkedEventId: string | null;
};

/** Leitura sujeita ao RLS: cada usuário só recebe as tarefas que pode ver. */
export type PracticeTaskRepository = {
  listVisible(organizationId: string): Promise<PracticeTask[]>;
  /** Tarefas visíveis ligadas a um arquivo de partitura. */
  listVisibleForFile(organizationId: string, pieceFileId: string): Promise<PracticeTask[]>;
  getById(organizationId: string, taskId: string): Promise<PracticeTask | null>;
  create(organizationId: string, input: PracticeTaskRecordInput): Promise<PracticeTask>;
  update(
    organizationId: string,
    taskId: string,
    input: PracticeTaskRecordInput,
  ): Promise<PracticeTask | null>;
  /** Substitui o público da tarefa (grupos e músicos indicados diretamente). */
  setAudience(
    organizationId: string,
    taskId: string,
    groupIds: string[],
    musicianIds: string[],
  ): Promise<void>;
  setClosed(organizationId: string, taskId: string, closed: boolean): Promise<PracticeTask | null>;
  delete(organizationId: string, taskId: string): Promise<void>;
};
