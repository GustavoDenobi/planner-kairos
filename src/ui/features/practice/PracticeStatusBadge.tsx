import type { PracticeTaskStudentStatus } from '@/domain/practice';
import {
  PRACTICE_STATUS_CLASS,
  PRACTICE_STATUS_LABEL,
} from '@/ui/features/practice/practice-labels';

export function PracticeStatusBadge({ status }: { status: PracticeTaskStudentStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRACTICE_STATUS_CLASS[status]}`}
    >
      {PRACTICE_STATUS_LABEL[status]}
    </span>
  );
}
