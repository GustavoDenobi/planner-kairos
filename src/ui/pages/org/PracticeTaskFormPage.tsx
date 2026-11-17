import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { BackButton } from '@/ui/components/BackButton';
import { PracticeTaskForm } from '@/ui/features/practice/PracticeTaskForm';
import {
  practiceTaskPath,
  practiceTasksPath,
  readPracticeTaskPrefill,
} from '@/ui/features/practice/practice-routes';
import { orgPageContentClass, scrollContentEndPaddingClass } from '@/ui/layouts/OrgListPageLayout';

export function PracticeTaskFormPage() {
  const { orgSlug, taskId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { resolveOrgBySlug } = useOrg();
  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;
  const prefill = useMemo(() => readPracticeTaskPrefill(searchParams), [searchParams]);

  if (!orgSlug || !org || !userId) {
    return null;
  }

  const backTo = taskId ? practiceTaskPath(orgSlug, taskId) : practiceTasksPath(orgSlug);

  return (
    <div className={`${orgPageContentClass} min-h-0 flex-1 overflow-y-auto ${scrollContentEndPaddingClass}`}>
      <div className="mb-4 flex items-center gap-2">
        <BackButton fallbackTo={backTo} />
        <h1 className="text-2xl font-bold text-text">{taskId ? 'Editar tarefa' : 'Nova tarefa'}</h1>
      </div>
      <PracticeTaskForm
        organizationId={org.id}
        userId={userId}
        taskId={taskId ?? null}
        prefill={prefill}
        onSaved={(task) => navigate(practiceTaskPath(orgSlug, task.id), { replace: true })}
        onCancel={() => navigate(backTo)}
      />
    </div>
  );
}
