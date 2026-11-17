import type {
  PracticeSubmission,
  PracticeSubmissionPageMark,
  PracticeSubmissionReviewInput,
} from '@/domain/practice';

export type CreatePracticeSubmissionInput = {
  id: string;
  taskId: string;
  musicianId: string;
  attempt: number;
  storagePath: string;
  mimeType: string;
  durationMs: number;
  byteSize: number;
  pageMarks: PracticeSubmissionPageMark[];
  studentNote: string | null;
  recordedAt: string | null;
};

/** Leitura sujeita ao RLS: o aluno só recebe os próprios envios. */
export type PracticeSubmissionRepository = {
  listForTask(organizationId: string, taskId: string): Promise<PracticeSubmission[]>;
  listForTasks(organizationId: string, taskIds: string[]): Promise<PracticeSubmission[]>;
  getById(organizationId: string, submissionId: string): Promise<PracticeSubmission | null>;
  create(
    organizationId: string,
    input: CreatePracticeSubmissionInput,
  ): Promise<PracticeSubmission>;
  review(
    organizationId: string,
    submissionId: string,
    input: PracticeSubmissionReviewInput,
  ): Promise<PracticeSubmission | null>;
  delete(organizationId: string, submissionId: string): Promise<void>;
};
