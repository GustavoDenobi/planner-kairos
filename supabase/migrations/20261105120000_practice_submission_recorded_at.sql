-- Envio de tarefa: quando a gravação foi feita (no aparelho do aluno), além de quando foi enviada.
-- O professor vê os dois horários; uma gravação feita bem antes do envio fica visível.

ALTER TABLE practice_submissions
  ADD COLUMN recorded_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN practice_submissions.recorded_at IS
  'Quando a gravação foi feita (relógio do aparelho, limitado ao horário do envio). Nulo em envios antigos.';

-- O relógio do aparelho pode estar adiantado: a gravação nunca é "depois" do envio.
CREATE OR REPLACE FUNCTION practice_submissions_clamp_recorded_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.recorded_at IS NOT NULL AND NEW.recorded_at > now() THEN
    NEW.recorded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER practice_submissions_clamp_recorded_at
  BEFORE INSERT ON practice_submissions
  FOR EACH ROW EXECUTE FUNCTION practice_submissions_clamp_recorded_at();

-- Mesmo guard de antes, com recorded_at entre os campos imutáveis.
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
     OR NEW.submitted_at <> OLD.submitted_at THEN
    RAISE EXCEPTION 'practice_submission_immutable_fields';
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
