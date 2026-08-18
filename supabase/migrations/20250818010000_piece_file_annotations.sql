-- Piece file annotations (overlay layers on PDF scores)

CREATE TYPE annotation_layer AS ENUM ('personal', 'section');
CREATE TYPE annotation_type AS ENUM ('stroke', 'highlight');

CREATE TABLE piece_file_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_file_id UUID NOT NULL REFERENCES piece_files (id) ON DELETE CASCADE,
  page_number INT NOT NULL CHECK (page_number > 0),
  layer annotation_layer NOT NULL,
  type annotation_type NOT NULL,
  geometry JSONB NOT NULL,
  color TEXT NOT NULL,
  author_user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT piece_file_annotations_layer_section_check CHECK (
    (layer = 'personal' AND section_id IS NULL)
    OR (layer = 'section' AND section_id IS NOT NULL)
  )
);

CREATE INDEX piece_file_annotations_file_page_idx
  ON piece_file_annotations (piece_file_id, page_number);

CREATE TRIGGER piece_file_annotations_updated_at
  BEFORE UPDATE ON piece_file_annotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Integrity: annotation org must match piece file org
CREATE OR REPLACE FUNCTION check_piece_file_annotation_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_file_org UUID;
BEGIN
  SELECT organization_id INTO v_file_org FROM piece_files WHERE id = NEW.piece_file_id;

  IF v_file_org IS NULL THEN
    RAISE EXCEPTION 'piece_file_annotation_invalid_reference';
  END IF;

  IF v_file_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_file_annotation_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_file_annotations_check_org
  BEFORE INSERT OR UPDATE ON piece_file_annotations
  FOR EACH ROW EXECUTE FUNCTION check_piece_file_annotation_org();

-- RLS helpers
CREATE OR REPLACE FUNCTION current_musician_id(p_org_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM musicians
  WHERE organization_id = p_org_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_in_section(p_org_id UUID, p_section_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments a
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE a.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND a.section_id = p_section_id
  );
$$;

CREATE OR REPLACE FUNCTION is_section_lead_for(p_org_id UUID, p_section_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments a
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE a.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND a.section_id = p_section_id
      AND a.ensemble_role = 'section_lead'
  );
$$;

ALTER TABLE piece_file_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY piece_file_annotations_select ON piece_file_annotations
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id)
    AND (
      (layer = 'personal' AND author_user_id = auth.uid())
      OR (layer = 'section' AND is_in_section(organization_id, section_id))
    )
  );

CREATE POLICY piece_file_annotations_insert ON piece_file_annotations
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND author_user_id = auth.uid()
    AND (
      (layer = 'personal' AND section_id IS NULL)
      OR (
        layer = 'section'
        AND section_id IS NOT NULL
        AND is_section_lead_for(organization_id, section_id)
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
    )
  )
  WITH CHECK (
    is_org_member(organization_id)
    AND author_user_id = auth.uid()
    AND (
      (layer = 'personal' AND section_id IS NULL)
      OR (
        layer = 'section'
        AND section_id IS NOT NULL
        AND is_section_lead_for(organization_id, section_id)
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
    )
  );

GRANT USAGE ON TYPE annotation_layer TO anon, authenticated, service_role;
GRANT USAGE ON TYPE annotation_type TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON piece_file_annotations TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION current_musician_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_in_section(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_section_lead_for(UUID, UUID) TO authenticated, service_role;
