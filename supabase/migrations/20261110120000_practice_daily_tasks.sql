-- Tarefas diárias: o aluno entrega uma gravação por dia cobrado, como prova de estudo.
--
-- * Cada organização tem um fuso: é ele que define o que é "hoje" para todos os membros.
-- * A tarefa diária tem um período (starts_on..ends_on) e os dias da semana cobrados.
-- * Cada envio de tarefa diária pertence a um dia (period_date), calculado pelo servidor:
--   a gravação tem de ter sido feita nesse mesmo dia. Tolerância: uma gravação feita
--   no dia anterior ainda conta para ele se for enviada até 02:00.
-- * Dia que passou sem entrega fica como falta: não há envio atrasado.
-- * Revisar não encerra a tarefa diária, e não existe pedido para refazer.
-- Mesmas regras em src/domain/practice/daily.ts.

-- ---------------------------------------------------------------------------
-- Fuso da organização
-- ---------------------------------------------------------------------------

ALTER TABLE organizations
  ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE OR REPLACE FUNCTION organizations_check_time_zone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.time_zone) THEN
    RAISE EXCEPTION 'invalid_time_zone';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_check_time_zone
  BEFORE INSERT OR UPDATE OF time_zone ON organizations
  FOR EACH ROW EXECUTE FUNCTION organizations_check_time_zone();

-- ---------------------------------------------------------------------------
-- Frequência da tarefa
-- ---------------------------------------------------------------------------

CREATE TYPE practice_task_cadence AS ENUM ('once', 'daily');

ALTER TABLE practice_tasks
  ADD COLUMN cadence practice_task_cadence NOT NULL DEFAULT 'once',
  ADD COLUMN starts_on DATE,
  ADD COLUMN ends_on DATE,
  -- Dias da semana cobrados: 0 = domingo … 6 = sábado (mesma convenção de EXTRACT(DOW)).
  ADD COLUMN weekdays SMALLINT[],
  ADD CONSTRAINT practice_tasks_daily_schedule CHECK (
    (
      cadence = 'once'
      AND starts_on IS NULL AND ends_on IS NULL AND weekdays IS NULL
    )
    OR (
      cadence = 'daily'
      AND starts_on IS NOT NULL
      AND ends_on IS NOT NULL
      AND ends_on >= starts_on
      AND ends_on - starts_on <= 366
      AND weekdays IS NOT NULL
      AND cardinality(weekdays) BETWEEN 1 AND 7
      AND weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
    )
  );

-- Tarefa diária: o prazo é o fim do último dia, no fuso da organização (ordena as listas).
CREATE OR REPLACE FUNCTION practice_tasks_daily_due_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz TEXT;
BEGIN
  IF NEW.cadence = 'daily' THEN
    SELECT time_zone INTO v_tz FROM organizations WHERE id = NEW.organization_id;
    NEW.due_at := ((NEW.ends_on + 1)::TIMESTAMP AT TIME ZONE COALESCE(v_tz, 'America/Sao_Paulo'))
      - INTERVAL '1 second';
    -- Não há envio atrasado em tarefa diária.
    NEW.accept_late_submissions := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER practice_tasks_daily_due_at
  BEFORE INSERT OR UPDATE ON practice_tasks
  FOR EACH ROW EXECUTE FUNCTION practice_tasks_daily_due_at();

-- O dia é cobrado nesta tarefa diária?
CREATE OR REPLACE FUNCTION practice_daily_is_charged_day(
  p_starts_on DATE,
  p_ends_on DATE,
  p_weekdays SMALLINT[],
  p_day DATE
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_day BETWEEN p_starts_on AND p_ends_on
    AND EXTRACT(DOW FROM p_day)::SMALLINT = ANY (p_weekdays);
$$;

-- Dia a que pertence uma gravação feita em p_recorded_at e enviada em p_at
-- (NULL se não pertence a nenhum dia cobrado, ou se a tarefa não é diária).
CREATE OR REPLACE FUNCTION practice_daily_period_for(
  p_task_id UUID,
  p_recorded_at TIMESTAMPTZ,
  p_at TIMESTAMPTZ
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_local TIMESTAMP;
  v_today DATE;
  v_recorded_day DATE;
BEGIN
  SELECT t.starts_on, t.ends_on, t.weekdays, o.time_zone
  INTO v_task
  FROM practice_tasks t
  INNER JOIN organizations o ON o.id = t.organization_id
  WHERE t.id = p_task_id AND t.cadence = 'daily';
  IF NOT FOUND OR p_recorded_at IS NULL THEN
    RETURN NULL;
  END IF;

  v_local := p_at AT TIME ZONE v_task.time_zone;
  v_today := v_local::DATE;
  v_recorded_day := (p_recorded_at AT TIME ZONE v_task.time_zone)::DATE;

  IF v_recorded_day = v_today
     AND practice_daily_is_charged_day(v_task.starts_on, v_task.ends_on, v_task.weekdays, v_today) THEN
    RETURN v_today;
  END IF;

  -- Tolerância: gravada ontem e enviada até 02:00 conta para ontem.
  IF v_recorded_day = v_today - 1
     AND v_local::TIME < TIME '02:00'
     AND practice_daily_is_charged_day(v_task.starts_on, v_task.ends_on, v_task.weekdays, v_today - 1) THEN
    RETURN v_today - 1;
  END IF;

  RETURN NULL;
END;
$$;

-- Há algum dia aberto para envio agora (hoje, ou ontem dentro da tolerância)?
CREATE OR REPLACE FUNCTION practice_daily_has_open_day(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM practice_tasks t
    INNER JOIN organizations o ON o.id = t.organization_id
    CROSS JOIN LATERAL (SELECT now() AT TIME ZONE o.time_zone AS local_now) l
    WHERE t.id = p_task_id
      AND t.cadence = 'daily'
      AND (
        practice_daily_is_charged_day(t.starts_on, t.ends_on, t.weekdays, l.local_now::DATE)
        OR (
          l.local_now::TIME < TIME '02:00'
          AND practice_daily_is_charged_day(t.starts_on, t.ends_on, t.weekdays, l.local_now::DATE - 1)
        )
      )
  );
$$;

-- Aluno pode enviar. Tarefa única: aberta, sem revisão final e dentro do prazo (ou com
-- atraso aceito / pedido para refazer). Tarefa diária: aberta e com um dia aberto agora.
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
      AND (
        (t.cadence = 'daily' AND practice_daily_has_open_day(t.id))
        OR (
          t.cadence = 'once'
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
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Dia de cada envio
-- ---------------------------------------------------------------------------

ALTER TABLE practice_submissions
  ADD COLUMN period_date DATE;

COMMENT ON COLUMN practice_submissions.period_date IS
  'Tarefa diária: dia (no fuso da organização) a que o envio pertence. Nulo em tarefa única.';

CREATE INDEX practice_submissions_period_idx
  ON practice_submissions (task_id, musician_id, period_date)
  WHERE period_date IS NOT NULL;

-- Roda depois do practice_submissions_clamp_recorded_at (ordem alfabética dos triggers).
CREATE OR REPLACE FUNCTION practice_submissions_set_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadence practice_task_cadence;
BEGIN
  SELECT cadence INTO v_cadence FROM practice_tasks WHERE id = NEW.task_id;
  IF v_cadence = 'daily' THEN
    NEW.period_date := practice_daily_period_for(NEW.task_id, NEW.recorded_at, now());
    IF NEW.period_date IS NULL THEN
      RAISE EXCEPTION 'practice_submission_outside_period';
    END IF;
  ELSE
    NEW.period_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER practice_submissions_set_period
  BEFORE INSERT ON practice_submissions
  FOR EACH ROW EXECUTE FUNCTION practice_submissions_set_period();

-- Mesmo guard de antes, com period_date imutável e sem "refazer" em tarefa diária.
CREATE OR REPLACE FUNCTION practice_submissions_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id
     OR NEW.task_id <> OLD.task_id
     OR NEW.musician_id <> OLD.musician_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.attempt <> OLD.attempt
     OR NEW.storage_path <> OLD.storage_path
     OR NEW.mime_type <> OLD.mime_type
     OR NEW.duration_ms <> OLD.duration_ms
     OR NEW.byte_size <> OLD.byte_size
     OR NEW.page_marks <> OLD.page_marks
     OR NEW.student_note IS DISTINCT FROM OLD.student_note
     OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.period_date IS DISTINCT FROM OLD.period_date
     OR NEW.submitted_at <> OLD.submitted_at THEN
    RAISE EXCEPTION 'practice_submission_immutable_fields';
  END IF;

  IF NEW.status = 'redo_requested' AND NEW.period_date IS NOT NULL THEN
    RAISE EXCEPTION 'practice_submission_redo_not_allowed';
  END IF;

  IF NEW.status = 'submitted' THEN
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  ELSE
    NEW.reviewed_at := now();
    NEW.reviewed_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT USAGE ON TYPE practice_task_cadence TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION practice_daily_is_charged_day(DATE, DATE, SMALLINT[], DATE)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION practice_daily_period_for(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION practice_daily_has_open_day(UUID) TO authenticated, service_role;
