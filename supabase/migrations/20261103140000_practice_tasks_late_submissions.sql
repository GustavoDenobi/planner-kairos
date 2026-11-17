-- Tarefas podem recusar envios depois do prazo.
-- Exceção: se o professor pediu para refazer, o aluno pode reenviar mesmo após o prazo.

ALTER TABLE practice_tasks
  ADD COLUMN accept_late_submissions BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION can_submit_practice_task(p_task_id UUID, p_musician_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM practice_tasks t
    WHERE t.id = p_task_id
      AND t.closed_at IS NULL
      AND p_musician_id = my_musician_id(t.organization_id)
      AND is_practice_task_student(t.id, p_musician_id)
      AND NOT EXISTS (
        SELECT 1 FROM practice_submissions s
        WHERE s.task_id = t.id
          AND s.musician_id = p_musician_id
          AND s.status = 'reviewed'
      )
      AND (
        t.accept_late_submissions
        OR now() <= t.due_at
        OR (
          SELECT s.status
          FROM practice_submissions s
          WHERE s.task_id = t.id AND s.musician_id = p_musician_id
          ORDER BY s.attempt DESC
          LIMIT 1
        ) = 'redo_requested'
      )
  );
$$;
