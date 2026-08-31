import { Link } from 'react-router-dom';
import type { MusicianBirthdayItem } from '@/domain/agenda';
import {
  birthdayCardTitle,
  formatBirthdayAssignmentLabel,
} from '@/ui/features/agenda/agenda-labels';

type AgendaBirthdayCardProps = {
  orgSlug: string;
  birthday: MusicianBirthdayItem;
};

export function AgendaBirthdayCard({ orgSlug, birthday }: AgendaBirthdayCardProps) {
  return (
    <Link
      to={`/${orgSlug}/musicos/${birthday.musicianId}`}
      className="block max-w-full overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg"
    >
      <div className="min-w-0 max-w-full">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-medium text-text">
            {birthdayCardTitle(birthday.fullName, birthday.ageTurning)}
          </p>
          <span className="shrink-0 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium text-pink-800 dark:bg-pink-950 dark:text-pink-200">
            Aniversário
          </span>
        </div>
        {birthday.assignments.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm text-muted">
            {birthday.assignments.map((assignment) => (
              <li
                key={`${birthday.musicianId}-${assignment.groupId}-${assignment.partName ?? assignment.sectionName ?? assignment.ensembleRole}`}
              >
                {formatBirthdayAssignmentLabel(assignment)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}
