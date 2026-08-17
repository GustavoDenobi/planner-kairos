import type {
  Assignment,
  AssignmentInput,
  AssignmentWithDetails,
} from '@/domain/ensemble';

export type AssignmentRepository = {
  listForMusician(
    organizationId: string,
    musicianId: string,
  ): Promise<AssignmentWithDetails[]>;
  getById(organizationId: string, assignmentId: string): Promise<Assignment | null>;
  create(
    organizationId: string,
    musicianId: string,
    input: AssignmentInput,
  ): Promise<Assignment>;
  update(
    organizationId: string,
    assignmentId: string,
    input: AssignmentInput,
  ): Promise<Assignment>;
  remove(organizationId: string, assignmentId: string): Promise<void>;
};
