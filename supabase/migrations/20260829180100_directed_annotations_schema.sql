-- Directed annotation sets (teacher → student/group audience on PDF scores)

CREATE TABLE annotation_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_file_id UUID NOT NULL REFERENCES piece_files (id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX annotation_sets_piece_file_idx ON annotation_sets (piece_file_id);
CREATE INDEX annotation_sets_org_idx ON annotation_sets (organization_id);

CREATE TRIGGER annotation_sets_updated_at
  BEFORE UPDATE ON annotation_sets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE annotation_set_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  annotation_set_id UUID NOT NULL REFERENCES annotation_sets (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (annotation_set_id, group_id)
);

CREATE INDEX annotation_set_groups_set_idx ON annotation_set_groups (annotation_set_id);
CREATE INDEX annotation_set_groups_group_idx ON annotation_set_groups (group_id);

CREATE TABLE annotation_set_musicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  annotation_set_id UUID NOT NULL REFERENCES annotation_sets (id) ON DELETE CASCADE,
  musician_id UUID NOT NULL REFERENCES musicians (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (annotation_set_id, musician_id)
);

CREATE INDEX annotation_set_musicians_set_idx ON annotation_set_musicians (annotation_set_id);
CREATE INDEX annotation_set_musicians_musician_idx ON annotation_set_musicians (musician_id);

ALTER TABLE piece_file_annotations
  ADD COLUMN annotation_set_id UUID REFERENCES annotation_sets (id) ON DELETE CASCADE;

CREATE INDEX piece_file_annotations_set_idx ON piece_file_annotations (annotation_set_id);

ALTER TABLE piece_file_annotations
  DROP CONSTRAINT piece_file_annotations_layer_section_check;

ALTER TABLE piece_file_annotations
  ADD CONSTRAINT piece_file_annotations_layer_check CHECK (
    (layer = 'personal' AND section_id IS NULL AND annotation_set_id IS NULL)
    OR (layer = 'section' AND section_id IS NOT NULL AND annotation_set_id IS NULL)
    OR (layer = 'directed' AND section_id IS NULL AND annotation_set_id IS NOT NULL)
  );

-- Integrity: annotation set org must match piece file org
CREATE OR REPLACE FUNCTION check_annotation_set_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_file_org UUID;
BEGIN
  SELECT organization_id INTO v_file_org FROM piece_files WHERE id = NEW.piece_file_id;

  IF v_file_org IS NULL THEN
    RAISE EXCEPTION 'annotation_set_invalid_reference';
  END IF;

  IF v_file_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'annotation_set_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER annotation_sets_check_org
  BEFORE INSERT OR UPDATE ON annotation_sets
  FOR EACH ROW EXECUTE FUNCTION check_annotation_set_org();

CREATE OR REPLACE FUNCTION check_annotation_set_group_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_set_org UUID;
  v_group_org UUID;
BEGIN
  SELECT organization_id INTO v_set_org FROM annotation_sets WHERE id = NEW.annotation_set_id;
  SELECT organization_id INTO v_group_org FROM groups WHERE id = NEW.group_id;

  IF v_set_org IS NULL THEN
    RAISE EXCEPTION 'annotation_set_group_invalid_set';
  END IF;

  IF v_group_org IS NULL THEN
    RAISE EXCEPTION 'annotation_set_group_invalid_group';
  END IF;

  IF v_set_org <> NEW.organization_id OR v_group_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'annotation_set_group_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER annotation_set_groups_check_org
  BEFORE INSERT OR UPDATE ON annotation_set_groups
  FOR EACH ROW EXECUTE FUNCTION check_annotation_set_group_org();

CREATE OR REPLACE FUNCTION check_annotation_set_musician_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_set_org UUID;
  v_musician_org UUID;
BEGIN
  SELECT organization_id INTO v_set_org FROM annotation_sets WHERE id = NEW.annotation_set_id;
  SELECT organization_id INTO v_musician_org FROM musicians WHERE id = NEW.musician_id;

  IF v_set_org IS NULL THEN
    RAISE EXCEPTION 'annotation_set_musician_invalid_set';
  END IF;

  IF v_musician_org IS NULL THEN
    RAISE EXCEPTION 'annotation_set_musician_invalid_musician';
  END IF;

  IF v_set_org <> NEW.organization_id OR v_musician_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'annotation_set_musician_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER annotation_set_musicians_check_org
  BEFORE INSERT OR UPDATE ON annotation_set_musicians
  FOR EACH ROW EXECUTE FUNCTION check_annotation_set_musician_org();

CREATE OR REPLACE FUNCTION can_see_annotation_set(p_set_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM annotation_sets s
    WHERE s.id = p_set_id
      AND is_org_member(s.organization_id)
      AND (
        has_org_role(s.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR s.author_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM annotation_set_musicians asm
          INNER JOIN musicians m ON m.id = asm.musician_id
          WHERE asm.annotation_set_id = s.id
            AND m.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM annotation_set_groups asg
          INNER JOIN assignments a ON a.group_id = asg.group_id
          INNER JOIN musicians m ON m.id = a.musician_id
          WHERE asg.annotation_set_id = s.id
            AND m.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION can_write_annotation_set(p_set_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM annotation_sets s
    WHERE s.id = p_set_id
      AND is_org_member(s.organization_id)
      AND (
        has_org_role(s.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR (
          s.author_user_id = auth.uid()
          AND (
            NOT EXISTS (
              SELECT 1 FROM annotation_set_groups asg WHERE asg.annotation_set_id = s.id
            )
            OR EXISTS (
              SELECT 1
              FROM annotation_set_groups asg
              WHERE asg.annotation_set_id = s.id
                AND is_teacher_of_group(s.organization_id, asg.group_id)
            )
          )
        )
      )
  );
$$;

ALTER TABLE annotation_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_set_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_set_musicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY annotation_sets_select ON annotation_sets
  FOR SELECT TO authenticated
  USING (can_see_annotation_set(id));

CREATE POLICY annotation_sets_insert ON annotation_sets
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND author_user_id = auth.uid()
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_in_org(organization_id)
    )
  );

CREATE POLICY annotation_sets_update ON annotation_sets
  FOR UPDATE TO authenticated
  USING (can_write_annotation_set(id))
  WITH CHECK (can_write_annotation_set(id));

CREATE POLICY annotation_sets_delete ON annotation_sets
  FOR DELETE TO authenticated
  USING (can_write_annotation_set(id));

CREATE POLICY annotation_set_groups_select ON annotation_set_groups
  FOR SELECT TO authenticated
  USING (can_see_annotation_set(annotation_set_id));

CREATE POLICY annotation_set_groups_write ON annotation_set_groups
  FOR ALL TO authenticated
  USING (can_write_annotation_set(annotation_set_id))
  WITH CHECK (can_write_annotation_set(annotation_set_id));

CREATE POLICY annotation_set_musicians_select ON annotation_set_musicians
  FOR SELECT TO authenticated
  USING (can_see_annotation_set(annotation_set_id));

CREATE POLICY annotation_set_musicians_write ON annotation_set_musicians
  FOR ALL TO authenticated
  USING (can_write_annotation_set(annotation_set_id))
  WITH CHECK (can_write_annotation_set(annotation_set_id));

DROP POLICY IF EXISTS piece_file_annotations_select ON piece_file_annotations;
DROP POLICY IF EXISTS piece_file_annotations_insert ON piece_file_annotations;
DROP POLICY IF EXISTS piece_file_annotations_update ON piece_file_annotations;
DROP POLICY IF EXISTS piece_file_annotations_delete ON piece_file_annotations;

CREATE POLICY piece_file_annotations_select ON piece_file_annotations
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id)
    AND (
      (layer = 'personal' AND author_user_id = auth.uid())
      OR (layer = 'section' AND is_in_section(organization_id, section_id))
      OR (layer = 'directed' AND can_see_annotation_set(annotation_set_id))
    )
  );

CREATE POLICY piece_file_annotations_insert ON piece_file_annotations
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND author_user_id = auth.uid()
    AND (
      (layer = 'personal' AND section_id IS NULL AND annotation_set_id IS NULL)
      OR (
        layer = 'section'
        AND section_id IS NOT NULL
        AND annotation_set_id IS NULL
        AND is_section_lead_for(organization_id, section_id)
      )
      OR (
        layer = 'directed'
        AND section_id IS NULL
        AND annotation_set_id IS NOT NULL
        AND can_write_annotation_set(annotation_set_id)
      )
    )
  );

CREATE POLICY piece_file_annotations_update ON piece_file_annotations
  FOR UPDATE TO authenticated
  USING (
    is_org_member(organization_id)
    AND (
      (layer = 'personal' AND author_user_id = auth.uid())
      OR (
        layer = 'section'
        AND section_id IS NOT NULL
        AND is_section_lead_for(organization_id, section_id)
      )
      OR (layer = 'directed' AND can_write_annotation_set(annotation_set_id))
    )
  )
  WITH CHECK (
    is_org_member(organization_id)
    AND author_user_id = auth.uid()
    AND (
      (layer = 'personal' AND section_id IS NULL AND annotation_set_id IS NULL)
      OR (
        layer = 'section'
        AND section_id IS NOT NULL
        AND annotation_set_id IS NULL
        AND is_section_lead_for(organization_id, section_id)
      )
      OR (
        layer = 'directed'
        AND section_id IS NULL
        AND annotation_set_id IS NOT NULL
        AND can_write_annotation_set(annotation_set_id)
      )
    )
  );

CREATE POLICY piece_file_annotations_delete ON piece_file_annotations
  FOR DELETE TO authenticated
  USING (
    is_org_member(organization_id)
    AND (
      (layer = 'personal' AND author_user_id = auth.uid())
      OR (
        layer = 'section'
        AND section_id IS NOT NULL
        AND is_section_lead_for(organization_id, section_id)
      )
      OR (layer = 'directed' AND can_write_annotation_set(annotation_set_id))
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON annotation_sets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON annotation_set_groups TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON annotation_set_musicians TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION can_see_annotation_set(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_write_annotation_set(UUID) TO authenticated, service_role;
