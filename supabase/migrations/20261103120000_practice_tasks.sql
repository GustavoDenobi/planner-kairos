-- Tarefas de estudo ("tarefas de casa"): professor/regente pede uma gravação até um prazo;
-- o aluno envia uma gravação de áudio; o professor revisa ou pede para refazer.
--
-- Arquivos dos envios ficam no bucket privado org-assets em
--   {org_id}/practice/{task_id}/{musician_id}/{submission_id}.{ext}
-- e só são visíveis para o próprio aluno e para quem gerencia a tarefa.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE practice_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  created_by UUID DEFAULT auth.uid() REFERENCES profiles (id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  instructions TEXT NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 4000),
  -- Referência opcional ao repertório (obra → arquivo → item do sumário ou ponto).
  piece_id UUID REFERENCES pieces (id) ON DELETE SET NULL,
  piece_file_id UUID REFERENCES piece_files (id) ON DELETE SET NULL,
  toc_entry_id UUID REFERENCES piece_file_toc_entries (id) ON DELETE SET NULL,
  -- Cópia do item do sumário: a tarefa continua abrindo no ponto certo se o item for apagado.
  toc_label_snapshot TEXT,
  target_page INT CHECK (target_page IS NULL OR target_page > 0),
  target_x REAL CHECK (target_x IS NULL OR (target_x >= 0 AND target_x <= 1)),
  target_y REAL CHECK (target_y IS NULL OR (target_y >= 0 AND target_y <= 1)),
  due_at TIMESTAMPTZ NOT NULL,
  linked_event_id UUID REFERENCES events (id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT practice_tasks_file_requires_piece CHECK (piece_file_id IS NULL OR piece_id IS NOT NULL),
  CONSTRAINT practice_tasks_location_requires_file CHECK (
    piece_file_id IS NOT NULL
    OR (toc_entry_id IS NULL AND toc_label_snapshot IS NULL AND target_page IS NULL)
  ),
  CONSTRAINT practice_tasks_toc_requires_page CHECK (
    toc_label_snapshot IS NULL OR target_page IS NOT NULL
  ),
  CONSTRAINT practice_tasks_coords_require_page CHECK (
    target_page IS NOT NULL OR (target_x IS NULL AND target_y IS NULL)
  )
);

CREATE INDEX practice_tasks_org_due_idx ON practice_tasks (organization_id, due_at);
CREATE INDEX practice_tasks_created_by_idx ON practice_tasks (created_by);
CREATE INDEX practice_tasks_piece_file_idx ON practice_tasks (piece_file_id)
  WHERE piece_file_id IS NOT NULL;

CREATE TRIGGER practice_tasks_updated_at
  BEFORE UPDATE ON practice_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE practice_task_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES practice_tasks (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, group_id)
);

CREATE INDEX practice_task_groups_group_idx ON practice_task_groups (group_id);

CREATE TABLE practice_task_musicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES practice_tasks (id) ON DELETE CASCADE,
  musician_id UUID NOT NULL REFERENCES musicians (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, musician_id)
);

CREATE INDEX practice_task_musicians_musician_idx ON practice_task_musicians (musician_id);

CREATE TYPE practice_submission_status AS ENUM ('submitted', 'reviewed', 'redo_requested');

CREATE TABLE practice_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES practice_tasks (id) ON DELETE CASCADE,
  musician_id UUID NOT NULL REFERENCES musicians (id) ON DELETE CASCADE,
  submitted_by UUID DEFAULT auth.uid() REFERENCES profiles (id) ON DELETE SET NULL,
  attempt INT NOT NULL CHECK (attempt > 0),
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  duration_ms INT NOT NULL CHECK (duration_ms >= 0),
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  page_marks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(page_marks) = 'array'),
  student_note TEXT CHECK (student_note IS NULL OR char_length(student_note) <= 1000),
  status practice_submission_status NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  feedback TEXT CHECK (feedback IS NULL OR char_length(feedback) <= 4000),
  UNIQUE (task_id, musician_id, attempt)
);

CREATE INDEX practice_submissions_task_idx ON practice_submissions (task_id, musician_id);
CREATE INDEX practice_submissions_musician_idx ON practice_submissions (musician_id);

-- ---------------------------------------------------------------------------
-- Integridade
-- ---------------------------------------------------------------------------

-- Normaliza a referência (inclusive após ON DELETE SET NULL) e confere organização.
CREATE OR REPLACE FUNCTION practice_tasks_normalize_and_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_piece_id UUID;
  v_file_id UUID;
  v_toc RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id <> OLD.organization_id THEN
      RAISE EXCEPTION 'practice_task_org_immutable';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL THEN
      RAISE EXCEPTION 'practice_task_creator_immutable';
    END IF;
  END IF;

  -- Obra removida: sem referência. Arquivo removido: fica só a obra.
  IF NEW.piece_id IS NULL THEN
    NEW.piece_file_id := NULL;
  END IF;
  IF NEW.piece_file_id IS NULL THEN
    NEW.toc_entry_id := NULL;
    NEW.toc_label_snapshot := NULL;
    NEW.target_page := NULL;
    NEW.target_x := NULL;
    NEW.target_y := NULL;
  END IF;

  IF NEW.piece_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.piece_id IS DISTINCT FROM OLD.piece_id) THEN
    SELECT organization_id INTO v_org FROM pieces WHERE id = NEW.piece_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'practice_task_invalid_piece';
    END IF;
  END IF;

  IF NEW.piece_file_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR NEW.piece_file_id IS DISTINCT FROM OLD.piece_file_id
          OR NEW.piece_id IS DISTINCT FROM OLD.piece_id) THEN
    SELECT organization_id, piece_id INTO v_org, v_piece_id
    FROM piece_files WHERE id = NEW.piece_file_id;
    IF v_org IS DISTINCT FROM NEW.organization_id OR v_piece_id IS DISTINCT FROM NEW.piece_id THEN
      RAISE EXCEPTION 'practice_task_invalid_piece_file';
    END IF;
  END IF;

  -- Item do sumário escolhido/alterado: copia rótulo e posição do próprio item.
  IF NEW.toc_entry_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.toc_entry_id IS DISTINCT FROM OLD.toc_entry_id) THEN
    SELECT organization_id, piece_file_id, label, target_page_number, target_x, target_y
    INTO v_toc
    FROM piece_file_toc_entries WHERE id = NEW.toc_entry_id;
    IF NOT FOUND
       OR v_toc.organization_id IS DISTINCT FROM NEW.organization_id
       OR v_toc.piece_file_id IS DISTINCT FROM NEW.piece_file_id THEN
      RAISE EXCEPTION 'practice_task_invalid_toc_entry';
    END IF;
    NEW.toc_label_snapshot := v_toc.label;
    NEW.target_page := v_toc.target_page_number;
    NEW.target_x := v_toc.target_x;
    NEW.target_y := v_toc.target_y;
  END IF;

  IF NEW.linked_event_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.linked_event_id IS DISTINCT FROM OLD.linked_event_id) THEN
    SELECT organization_id INTO v_org FROM events WHERE id = NEW.linked_event_id;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'practice_task_invalid_event';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER practice_tasks_normalize_and_check
  BEFORE INSERT OR UPDATE ON practice_tasks
  FOR EACH ROW EXECUTE FUNCTION practice_tasks_normalize_and_check();

CREATE OR REPLACE FUNCTION check_practice_task_target_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_org UUID;
  v_target_org UUID;
BEGIN
  SELECT organization_id INTO v_task_org FROM practice_tasks WHERE id = NEW.task_id;
  IF TG_TABLE_NAME = 'practice_task_groups' THEN
    SELECT organization_id INTO v_target_org FROM groups WHERE id = NEW.group_id;
  ELSE
    SELECT organization_id INTO v_target_org FROM musicians WHERE id = NEW.musician_id;
  END IF;

  IF v_task_org IS NULL OR v_target_org IS NULL
     OR v_task_org <> NEW.organization_id OR v_target_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'practice_task_target_org_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER practice_task_groups_check_org
  BEFORE INSERT OR UPDATE ON practice_task_groups
  FOR EACH ROW EXECUTE FUNCTION check_practice_task_target_org();

CREATE TRIGGER practice_task_musicians_check_org
  BEFORE INSERT OR UPDATE ON practice_task_musicians
  FOR EACH ROW EXECUTE FUNCTION check_practice_task_target_org();

-- ---------------------------------------------------------------------------
-- Funções de acesso
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION my_musician_id(p_org_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id
  FROM musicians m
  WHERE m.organization_id = p_org_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$;

-- O músico é aluno da tarefa: indicado diretamente ou membro de um grupo da tarefa.
CREATE OR REPLACE FUNCTION is_practice_task_student(p_task_id UUID, p_musician_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_musician_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM practice_task_musicians ptm
      WHERE ptm.task_id = p_task_id AND ptm.musician_id = p_musician_id
    )
    OR EXISTS (
      SELECT 1
      FROM practice_task_groups ptg
      INNER JOIN assignments a ON a.group_id = ptg.group_id
      WHERE ptg.task_id = p_task_id AND a.musician_id = p_musician_id
    )
  );
$$;

-- Professor/regente atua em algum grupo da tarefa (não relê practice_tasks).
CREATE OR REPLACE FUNCTION is_teacher_of_practice_task_group(p_org_id UUID, p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM practice_task_groups ptg
    WHERE ptg.task_id = p_task_id
      AND is_teacher_of_group(p_org_id, ptg.group_id)
  );
$$;

-- Admin; ou professor/regente que criou a tarefa ou que atua num grupo da tarefa.
CREATE OR REPLACE FUNCTION can_manage_practice_task(p_task_id UUID)
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
      AND is_org_member(t.organization_id)
      AND (
        has_org_role(t.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR (
          is_teacher_in_org(t.organization_id)
          AND (
            t.created_by = auth.uid()
            OR is_teacher_of_practice_task_group(t.organization_id, t.id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION can_see_practice_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT can_manage_practice_task(p_task_id)
    OR EXISTS (
      SELECT 1
      FROM practice_tasks t
      WHERE t.id = p_task_id
        AND is_practice_task_student(t.id, my_musician_id(t.organization_id))
    );
$$;

-- Aluno pode enviar: é aluno da tarefa, ela está aberta e ainda não houve revisão final.
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
  );
$$;

-- Envios: o professor só altera status e comentário; data e autor da revisão são do servidor.
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

CREATE TRIGGER practice_submissions_guard_update
  BEFORE UPDATE ON practice_submissions
  FOR EACH ROW EXECUTE FUNCTION practice_submissions_guard_update();

-- Caminho {org}/practice/{task}/{musician}/arquivo → task e musician (NULL se não for desse formato).
CREATE OR REPLACE FUNCTION storage_practice_ids_from_path(p_name TEXT)
RETURNS TABLE (task_id UUID, musician_id UUID)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE WHEN parts[2] = 'practice' AND parts[3] ~* '^[0-9a-f-]{36}$' THEN parts[3]::UUID END,
    CASE WHEN parts[2] = 'practice' AND parts[4] ~* '^[0-9a-f-]{36}$' THEN parts[4]::UUID END
  FROM (SELECT string_to_array(p_name, '/') AS parts) s;
$$;

CREATE OR REPLACE FUNCTION can_read_practice_storage_object(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM storage_practice_ids_from_path(p_name) ids
    INNER JOIN practice_tasks t ON t.id = ids.task_id
    WHERE t.organization_id = storage_org_id_from_path(p_name)
      AND (
        ids.musician_id = my_musician_id(t.organization_id)
        OR can_manage_practice_task(t.id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE practice_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_task_musicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_submissions ENABLE ROW LEVEL SECURITY;

-- Regras escritas sobre as colunas da própria linha (sem reler practice_tasks por função):
-- assim INSERT ... RETURNING enxerga a linha recém-criada.
CREATE POLICY practice_tasks_select ON practice_tasks
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR (
        is_teacher_in_org(organization_id)
        AND (
          created_by = (SELECT auth.uid())
          OR is_teacher_of_practice_task_group(organization_id, id)
        )
      )
      OR is_practice_task_student(id, my_musician_id(organization_id))
    )
  );

CREATE POLICY practice_tasks_insert ON practice_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND is_org_member(organization_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_in_org(organization_id)
    )
  );

CREATE POLICY practice_tasks_update ON practice_tasks
  FOR UPDATE TO authenticated
  USING (can_manage_practice_task(id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY practice_tasks_delete ON practice_tasks
  FOR DELETE TO authenticated
  USING (can_manage_practice_task(id));

CREATE POLICY practice_task_groups_select ON practice_task_groups
  FOR SELECT TO authenticated
  USING (can_see_practice_task(task_id));

CREATE POLICY practice_task_groups_insert ON practice_task_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    can_manage_practice_task(task_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_of_group(organization_id, group_id)
    )
  );

CREATE POLICY practice_task_groups_delete ON practice_task_groups
  FOR DELETE TO authenticated
  USING (can_manage_practice_task(task_id));

-- Aluno vê só a própria linha (não a lista de colegas indicados individualmente).
CREATE POLICY practice_task_musicians_select ON practice_task_musicians
  FOR SELECT TO authenticated
  USING (
    can_manage_practice_task(task_id)
    OR musician_id = my_musician_id(organization_id)
  );

CREATE POLICY practice_task_musicians_insert ON practice_task_musicians
  FOR INSERT TO authenticated
  WITH CHECK (
    can_manage_practice_task(task_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR musician_in_teacher_groups(organization_id, musician_id)
    )
  );

CREATE POLICY practice_task_musicians_delete ON practice_task_musicians
  FOR DELETE TO authenticated
  USING (can_manage_practice_task(task_id));

CREATE POLICY practice_submissions_select ON practice_submissions
  FOR SELECT TO authenticated
  USING (
    musician_id = my_musician_id(organization_id)
    OR can_manage_practice_task(task_id)
  );

CREATE POLICY practice_submissions_insert ON practice_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'submitted'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND feedback IS NULL
    AND can_submit_practice_task(task_id, musician_id)
    AND storage_path LIKE
      organization_id::TEXT || '/practice/' || task_id::TEXT || '/' || musician_id::TEXT || '/%'
  );

CREATE POLICY practice_submissions_update ON practice_submissions
  FOR UPDATE TO authenticated
  USING (can_manage_practice_task(task_id))
  WITH CHECK (can_manage_practice_task(task_id));

-- O aluno pode desistir de um envio ainda não revisado; admin pode apagar qualquer um.
CREATE POLICY practice_submissions_delete ON practice_submissions
  FOR DELETE TO authenticated
  USING (
    (musician_id = my_musician_id(organization_id) AND status = 'submitted')
    OR has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
  );

-- Storage: arquivos de tarefas deixam de ser visíveis para todos os membros da org.
DROP POLICY IF EXISTS org_assets_select_member ON storage.objects;

CREATE POLICY org_assets_select_member ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND is_org_member(storage_org_id_from_path(name))
    AND (
      name NOT LIKE storage_org_id_from_path(name)::TEXT || '/pieces/%'
      OR can_access_piece_file(storage_piece_file_id_from_path(name))
    )
    AND (
      name NOT LIKE storage_org_id_from_path(name)::TEXT || '/practice/%'
      OR can_read_practice_storage_object(name)
    )
  );

CREATE POLICY org_assets_insert_practice_student ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-assets'
    AND name LIKE storage_org_id_from_path(name)::TEXT || '/practice/%'
    AND EXISTS (
      SELECT 1
      FROM storage_practice_ids_from_path(name) ids
      WHERE can_submit_practice_task(ids.task_id, ids.musician_id)
    )
  );

CREATE POLICY org_assets_delete_practice ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND name LIKE storage_org_id_from_path(name)::TEXT || '/practice/%'
    AND (
      has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
      OR EXISTS (
        SELECT 1
        FROM storage_practice_ids_from_path(name) ids
        WHERE ids.musician_id = my_musician_id(storage_org_id_from_path(name))
          OR can_manage_practice_task(ids.task_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE
  ON practice_tasks, practice_task_groups, practice_task_musicians, practice_submissions
  TO authenticated, service_role;

GRANT USAGE ON TYPE practice_submission_status TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION my_musician_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_practice_task_student(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_teacher_of_practice_task_group(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_manage_practice_task(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_see_practice_task(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_submit_practice_task(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage_practice_ids_from_path(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_read_practice_storage_object(TEXT) TO authenticated, service_role;
