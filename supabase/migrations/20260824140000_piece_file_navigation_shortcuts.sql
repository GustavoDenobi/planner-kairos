-- Navigation shortcuts for PDF scores (repeat jumps, codas, etc.)

CREATE TABLE piece_file_navigation_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_file_id UUID NOT NULL REFERENCES piece_files (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL CHECK (sort_order >= 0),
  target_page_number INT NOT NULL CHECK (target_page_number > 0),
  target_y REAL CHECK (target_y IS NULL OR (target_y >= 0 AND target_y <= 1)),
  anchor_page_number INT CHECK (anchor_page_number IS NULL OR anchor_page_number > 0),
  anchor_x REAL CHECK (anchor_x IS NULL OR (anchor_x >= 0 AND anchor_x <= 1)),
  anchor_y REAL CHECK (anchor_y IS NULL OR (anchor_y >= 0 AND anchor_y <= 1)),
  author_user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT piece_file_navigation_shortcuts_anchor_check CHECK (
    (
      anchor_page_number IS NULL
      AND anchor_x IS NULL
      AND anchor_y IS NULL
    )
    OR (
      anchor_page_number IS NOT NULL
      AND anchor_x IS NOT NULL
      AND anchor_y IS NOT NULL
    )
  )
);

CREATE INDEX piece_file_navigation_shortcuts_file_sort_idx
  ON piece_file_navigation_shortcuts (piece_file_id, sort_order);

CREATE TRIGGER piece_file_navigation_shortcuts_updated_at
  BEFORE UPDATE ON piece_file_navigation_shortcuts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION check_piece_file_navigation_shortcut_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_file_org UUID;
BEGIN
  SELECT organization_id INTO v_file_org FROM piece_files WHERE id = NEW.piece_file_id;

  IF v_file_org IS NULL THEN
    RAISE EXCEPTION 'piece_file_navigation_shortcut_invalid_reference';
  END IF;

  IF v_file_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_file_navigation_shortcut_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_file_navigation_shortcuts_check_org
  BEFORE INSERT OR UPDATE ON piece_file_navigation_shortcuts
  FOR EACH ROW EXECUTE FUNCTION check_piece_file_navigation_shortcut_org();

CREATE OR REPLACE FUNCTION can_manage_piece_file_navigation_shortcuts(p_piece_file_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM piece_files pf
    WHERE pf.id = p_piece_file_id
      AND pf.kind = 'score'
      AND (
        has_org_role(pf.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR EXISTS (
          SELECT 1
          FROM piece_groups pg
          WHERE pg.piece_id = pf.piece_id
            AND is_teacher_of_group(pf.organization_id, pg.group_id)
        )
        OR EXISTS (
          SELECT 1
          FROM piece_file_part_links pfpl
          INNER JOIN section_parts sp ON sp.part_id = pfpl.part_id
          INNER JOIN assignments a
            ON a.section_id = sp.section_id
            AND a.organization_id = pf.organization_id
            AND a.ensemble_role = 'section_lead'
          INNER JOIN musicians m ON m.id = a.musician_id
          WHERE pfpl.piece_file_id = pf.id
            AND m.user_id = auth.uid()
        )
      )
  );
$$;

ALTER TABLE piece_file_navigation_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY piece_file_navigation_shortcuts_select ON piece_file_navigation_shortcuts
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id)
    AND can_access_piece_file(piece_file_id)
  );

CREATE POLICY piece_file_navigation_shortcuts_insert ON piece_file_navigation_shortcuts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND can_manage_piece_file_navigation_shortcuts(piece_file_id)
  );

CREATE POLICY piece_file_navigation_shortcuts_update ON piece_file_navigation_shortcuts
  FOR UPDATE TO authenticated
  USING (can_manage_piece_file_navigation_shortcuts(piece_file_id))
  WITH CHECK (
    author_user_id = auth.uid()
    AND can_manage_piece_file_navigation_shortcuts(piece_file_id)
  );

CREATE POLICY piece_file_navigation_shortcuts_delete ON piece_file_navigation_shortcuts
  FOR DELETE TO authenticated
  USING (can_manage_piece_file_navigation_shortcuts(piece_file_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON piece_file_navigation_shortcuts
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION can_manage_piece_file_navigation_shortcuts(UUID)
  TO authenticated, service_role;
