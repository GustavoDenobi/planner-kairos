import type { PracticeSubmissionRepository } from '@/application/ports/practice-submission-repository';
import type {
  PracticeSubmission,
  PracticeSubmissionPageMark,
  PracticeSubmissionStatus,
} from '@/domain/practice';
import type { Json } from './database.types';
import { supabase } from './client';

const SUBMISSION_COLUMNS = `
  id, organization_id, task_id, musician_id, submitted_by, attempt, storage_path, mime_type,
  duration_ms, byte_size, page_marks, student_note, status, recorded_at, period_date, submitted_at, reviewed_at,
  reviewed_by, feedback,
  musicians (full_name)
`;

type SubmissionRow = {
  id: string;
  organization_id: string;
  task_id: string;
  musician_id: string;
  submitted_by: string | null;
  attempt: number;
  storage_path: string;
  mime_type: string;
  duration_ms: number;
  byte_size: number;
  page_marks: Json;
  student_note: string | null;
  status: PracticeSubmissionStatus;
  recorded_at: string | null;
  period_date: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  feedback: string | null;
  musicians: { full_name: string } | null;
};

function parsePageMarks(value: Json): PracticeSubmissionPageMark[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const marks: PracticeSubmissionPageMark[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const { atSec, pieceFileId, page } = item as Record<string, unknown>;
    if (typeof atSec === 'number' && typeof pieceFileId === 'string' && typeof page === 'number') {
      marks.push({ atSec, pieceFileId, page });
    }
  }
  return marks;
}

function mapSubmission(row: SubmissionRow): PracticeSubmission {
  return {
    id: row.id,
    organizationId: row.organization_id,
    taskId: row.task_id,
    musicianId: row.musician_id,
    musicianName: row.musicians?.full_name ?? null,
    submittedBy: row.submitted_by,
    attempt: row.attempt,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    durationMs: row.duration_ms,
    byteSize: row.byte_size,
    pageMarks: parsePageMarks(row.page_marks),
    studentNote: row.student_note,
    status: row.status,
    recordedAt: row.recorded_at,
    periodDate: row.period_date,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    feedback: row.feedback,
  };
}

export function createPracticeSubmissionRepository(): PracticeSubmissionRepository {
  async function getById(organizationId: string, submissionId: string) {
    const { data, error } = await supabase
      .from('practice_submissions')
      .select(SUBMISSION_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('id', submissionId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return mapSubmission(data as unknown as SubmissionRow);
  }

  return {
    async listForTask(organizationId, taskId) {
      const { data, error } = await supabase
        .from('practice_submissions')
        .select(SUBMISSION_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('task_id', taskId)
        .order('attempt', { ascending: false });

      if (error || !data) {
        return [];
      }
      return (data as unknown as SubmissionRow[]).map(mapSubmission);
    },

    async listForTasks(organizationId, taskIds) {
      if (taskIds.length === 0) {
        return [];
      }
      const { data, error } = await supabase
        .from('practice_submissions')
        .select(SUBMISSION_COLUMNS)
        .eq('organization_id', organizationId)
        .in('task_id', taskIds);

      if (error || !data) {
        return [];
      }
      return (data as unknown as SubmissionRow[]).map(mapSubmission);
    },

    getById,

    async create(organizationId, input) {
      const { data, error } = await supabase
        .from('practice_submissions')
        .insert({
          id: input.id,
          organization_id: organizationId,
          task_id: input.taskId,
          musician_id: input.musicianId,
          attempt: input.attempt,
          storage_path: input.storagePath,
          mime_type: input.mimeType,
          duration_ms: input.durationMs,
          byte_size: input.byteSize,
          page_marks: input.pageMarks as unknown as Json,
          student_note: input.studentNote,
          recorded_at: input.recordedAt,
        })
        .select(SUBMISSION_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'practice_submission_create_failed');
      }
      return mapSubmission(data as unknown as SubmissionRow);
    },

    async review(organizationId, submissionId, input) {
      // reviewed_at e reviewed_by são preenchidos pelo banco.
      const { error } = await supabase
        .from('practice_submissions')
        .update({ status: input.status, feedback: input.feedback })
        .eq('organization_id', organizationId)
        .eq('id', submissionId);

      if (error) {
        throw new Error(error.message);
      }
      return getById(organizationId, submissionId);
    },

    async delete(organizationId, submissionId) {
      const { error } = await supabase
        .from('practice_submissions')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', submissionId);

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
