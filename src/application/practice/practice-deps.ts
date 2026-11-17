import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { FileStorage } from '@/application/ports/file-storage';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceFileTocEntryRepository } from '@/application/ports/piece-file-toc-entry-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { PracticeSubmissionRepository } from '@/application/ports/practice-submission-repository';
import type { PracticeTaskRepository } from '@/application/ports/practice-task-repository';
import type { PracticeWriterContext } from '@/domain/practice';
import type { Result } from '@/domain/shared';

export type PracticeAccessContext = PracticeWriterContext & {
  myMusicianId: string | null;
  /** Grupos de que o usuário participa (qualquer papel). */
  memberGroupIds: string[];
};

export type LoadPracticeAccessContext = (
  organizationId: string,
  userId: string,
) => Promise<Result<PracticeAccessContext, 'not_a_member'>>;

export type PracticeDeps = {
  taskRepo: PracticeTaskRepository;
  submissionRepo: PracticeSubmissionRepository;
  assignmentRepo: Pick<AssignmentRepository, 'listForGroup'>;
  pieceRepo: Pick<PieceRepository, 'getById'>;
  pieceFileRepo: Pick<PieceFileRepository, 'getById'>;
  tocRepo: Pick<PieceFileTocEntryRepository, 'listForFile'>;
  fileStorage: Pick<FileStorage, 'uploadPracticeRecording' | 'remove' | 'getSignedUrl'>;
  loadContext: LoadPracticeAccessContext;
  newId: () => string;
  now: () => Date;
};

/** Grupos em que o usuário é aluno (participa, mas não como professor/regente). */
export function studentGroupIds(context: PracticeAccessContext): Set<string> {
  const writable = new Set(context.writableGroupIds);
  return new Set(context.memberGroupIds.filter((groupId) => !writable.has(groupId)));
}
