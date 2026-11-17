export type PracticeSubmissionStatus = 'submitted' | 'reviewed' | 'redo_requested';

export type PracticeSubmissionPageMark = {
  atSec: number;
  pieceFileId: string;
  page: number;
};

/** Gravação enviada por um aluno para uma tarefa. */
export type PracticeSubmission = {
  id: string;
  organizationId: string;
  taskId: string;
  musicianId: string;
  musicianName: string | null;
  submittedBy: string | null;
  attempt: number;
  storagePath: string;
  mimeType: string;
  durationMs: number;
  byteSize: number;
  pageMarks: PracticeSubmissionPageMark[];
  studentNote: string | null;
  status: PracticeSubmissionStatus;
  /** Quando a gravação foi feita (nulo em envios antigos). */
  recordedAt: string | null;
  /** Tarefa diária: dia (AAAA-MM-DD, fuso da organização) a que o envio pertence. */
  periodDate: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  feedback: string | null;
};

export type PracticeSubmissionReviewInput = {
  status: Extract<PracticeSubmissionStatus, 'reviewed' | 'redo_requested'>;
  feedback: string | null;
};

export const PRACTICE_SUBMISSION_NOTE_MAX_LENGTH = 1000;
export const PRACTICE_SUBMISSION_FEEDBACK_MAX_LENGTH = 4000;
/** Limite por envio. Áudio em Opus fica em ~1 MB/min; cobre ~1 h com folga. */
/** Mesmo limite por arquivo do bucket org-assets (50 MB ≈ 50 min de áudio comprimido). */
export const PRACTICE_SUBMISSION_MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/mpeg'];

export function isAllowedPracticeSubmissionMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function practiceSubmissionFileExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('webm')) {
    return 'webm';
  }
  if (normalized.includes('ogg')) {
    return 'ogg';
  }
  if (normalized.includes('mpeg')) {
    return 'mp3';
  }
  return 'm4a';
}

/** Caminho no storage: as policies leem tarefa e músico das posições 3 e 4. */
export function buildPracticeSubmissionStoragePath(input: {
  organizationId: string;
  taskId: string;
  musicianId: string;
  submissionId: string;
  mimeType: string;
}): string {
  const extension = practiceSubmissionFileExtension(input.mimeType);
  return `${input.organizationId}/practice/${input.taskId}/${input.musicianId}/${input.submissionId}.${extension}`;
}
