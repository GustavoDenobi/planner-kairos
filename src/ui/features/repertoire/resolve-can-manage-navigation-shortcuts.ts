import type { AssignmentWithDetails } from '@/domain/ensemble';
import { isGroupWriterRole } from '@/domain/ensemble';
import type { PieceFilePartLink } from '@/domain/repertoire';

export function resolveCanManageNavigationShortcuts(input: {
  isAdmin: boolean;
  assignments: AssignmentWithDetails[];
  pieceGroupIds: string[];
  filePartLinks: PieceFilePartLink[];
  sectionPartIdsBySectionLead: string[];
}): boolean {
  if (input.isAdmin) {
    return true;
  }

  const pieceGroupSet = new Set(input.pieceGroupIds);
  const isTeacherForPiece = input.assignments.some(
    (assignment) =>
      isGroupWriterRole(assignment.ensembleRole)
      && pieceGroupSet.has(assignment.groupId),
  );
  if (isTeacherForPiece) {
    return true;
  }

  if (input.filePartLinks.length === 0) {
    return false;
  }

  const filePartIds = new Set(input.filePartLinks.map((link) => link.partId));
  const sectionPartSet = new Set(input.sectionPartIdsBySectionLead);
  return [...filePartIds].some((partId) => sectionPartSet.has(partId));
}
