import { loadWriterContext } from '@/application/agenda/event-use-cases-helpers';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { FileStorage } from '@/application/ports/file-storage';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceFileTocEntryRepository } from '@/application/ports/piece-file-toc-entry-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { PracticeSubmissionRepository } from '@/application/ports/practice-submission-repository';
import type { PracticeTaskRepository } from '@/application/ports/practice-task-repository';
import type { PracticeSubmissionReviewInput, PracticeTaskInput } from '@/domain/practice';
import type { PracticeDeps } from './practice-deps';
import {
  getPracticeSubmissionAudioUrl,
  reviewPracticeSubmission,
  submitPracticeRecording,
  withdrawPracticeSubmission,
  type SubmitPracticeRecordingInput,
} from './submission-use-cases';
import {
  listPracticeStudentsOverview,
  type PracticeOverviewAudience,
} from './student-overview-use-cases';
import {
  createPracticeTask,
  deletePracticeTask,
  getPracticeTaskDetail,
  listAssignedPracticeTasks,
  listPracticeTasks,
  listPracticeTasksForFile,
  setPracticeTaskClosed,
  updatePracticeTask,
} from './task-use-cases';

export type {
  AssignedPracticeTaskItem,
  ManagedPracticeTaskItem,
  PracticeStudentRow,
  PracticeTaskCounts,
  PracticeTaskDetail,
  PracticeTaskList,
  PracticeTaskWriteError,
} from './task-use-cases';
export type {
  SubmitPracticeRecordingError,
  SubmitPracticeRecordingInput,
} from './submission-use-cases';
export type { PracticeAccessContext, PracticeDeps } from './practice-deps';
export type {
  PracticeLessonAttention,
  PracticeLessonStudentSummary,
  PracticeOverviewAudience,
  PracticeStudentOverview,
  PracticeStudentsOverview,
  PracticeStudentTaskItem,
} from './student-overview-use-cases';
export { practiceLessonAttention, summarizePracticeLesson } from './student-overview-use-cases';

export type PracticeUseCaseDeps = {
  taskRepo: PracticeTaskRepository;
  submissionRepo: PracticeSubmissionRepository;
  assignmentRepo: AssignmentRepository;
  membershipRepo: MembershipRepository;
  musicianRepo: MusicianRepository;
  orgRepo: OrganizationRepository;
  pieceRepo: PieceRepository;
  pieceFileRepo: PieceFileRepository;
  tocRepo: PieceFileTocEntryRepository;
  fileStorage: FileStorage;
};

export function createPracticeUseCases(input: PracticeUseCaseDeps) {
  const deps: PracticeDeps = {
    taskRepo: input.taskRepo,
    submissionRepo: input.submissionRepo,
    assignmentRepo: input.assignmentRepo,
    pieceRepo: input.pieceRepo,
    pieceFileRepo: input.pieceFileRepo,
    tocRepo: input.tocRepo,
    fileStorage: input.fileStorage,
    loadContext: (organizationId, userId) =>
      loadWriterContext(
        input.membershipRepo,
        input.musicianRepo,
        input.assignmentRepo,
        input.orgRepo,
        organizationId,
        userId,
      ),
    newId: () => crypto.randomUUID(),
    now: () => new Date(),
  };

  return {
    listTasks: (organizationId: string, userId: string) =>
      listPracticeTasks(deps, organizationId, userId),
    listAssignedTasks: (organizationId: string, userId: string) =>
      listAssignedPracticeTasks(deps, organizationId, userId),
    listTasksForFile: (organizationId: string, userId: string, pieceFileId: string) =>
      listPracticeTasksForFile(deps, organizationId, userId, pieceFileId),
    listStudentsOverview: (
      organizationId: string,
      userId: string,
      audience: PracticeOverviewAudience,
    ) => listPracticeStudentsOverview(deps, organizationId, userId, audience),
    getTask: (organizationId: string, userId: string, taskId: string) =>
      getPracticeTaskDetail(deps, organizationId, userId, taskId),
    createTask: (organizationId: string, userId: string, taskInput: PracticeTaskInput) =>
      createPracticeTask(deps, organizationId, userId, taskInput),
    updateTask: (
      organizationId: string,
      userId: string,
      taskId: string,
      taskInput: PracticeTaskInput,
    ) => updatePracticeTask(deps, organizationId, userId, taskId, taskInput),
    setTaskClosed: (organizationId: string, userId: string, taskId: string, closed: boolean) =>
      setPracticeTaskClosed(deps, organizationId, userId, taskId, closed),
    deleteTask: (organizationId: string, userId: string, taskId: string) =>
      deletePracticeTask(deps, organizationId, userId, taskId),
    submitRecording: (
      organizationId: string,
      userId: string,
      taskId: string,
      recording: SubmitPracticeRecordingInput,
    ) => submitPracticeRecording(deps, organizationId, userId, taskId, recording),
    reviewSubmission: (
      organizationId: string,
      userId: string,
      submissionId: string,
      review: PracticeSubmissionReviewInput,
    ) => reviewPracticeSubmission(deps, organizationId, userId, submissionId, review),
    withdrawSubmission: (organizationId: string, userId: string, submissionId: string) =>
      withdrawPracticeSubmission(deps, organizationId, userId, submissionId),
    getSubmissionAudioUrl: (organizationId: string, submissionId: string) =>
      getPracticeSubmissionAudioUrl(deps, organizationId, submissionId),
  };
}

export type PracticeUseCases = ReturnType<typeof createPracticeUseCases>;
