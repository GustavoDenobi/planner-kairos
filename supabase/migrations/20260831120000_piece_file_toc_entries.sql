-- Table of Contents entries for PDF scores (lesson index for methods)

CREATE TABLE piece_file_toc_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_file_id UUID NOT NULL REFERENCES piece_files (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL CHECK (sort_order >= 0),
  target_page_number INT NOT NULL CHECK (target_page_number > 0),
  target_x REAL CHECK (target_x IS NULL OR (target_x >= 0 AND target_x <= 1)),
  target_y REAL CHECK (target_y IS NULL OR (target_y >= 0 AND target_y <= 1)),
  end_page_number INT CHECK (end_page_number IS NULL OR end_page_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT piece_file_toc_entries_end_page_check CHECK (
    end_page_number IS NULL
    OR end_page_number >= target_page_number
  )
);

CREATE INDEX piece_file_toc_entries_file_sort_idx
  ON piece_file_toc_entries (piece_file_id, sort_order);

CREATE TRIGGER piece_file_toc_entries_updated_at
  BEFORE UPDATE ON piece_file_toc_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION check_piece_file_toc_entry_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_file_org UUID;
BEGIN
  SELECT organization_id INTO v_file_org FROM piece_files WHERE id = NEW.piece_file_id;

  IF v_file_org IS NULL THEN
    RAISE EXCEPTION 'piece_file_toc_entry_invalid_reference';
  END IF;

  IF v_file_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_file_toc_entry_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_file_toc_entries_check_org
  BEFORE INSERT OR UPDATE ON piece_file_toc_entries
  FOR EACH ROW EXECUTE FUNCTION check_piece_file_toc_entry_org();

CREATE OR REPLACE FUNCTION can_manage_piece_file_toc_entries(p_piece_file_id UUID)
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

ALTER TABLE piece_file_toc_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY piece_file_toc_entries_select ON piece_file_toc_entries
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id)
    AND can_access_piece_file(piece_file_id)
  );

CREATE POLICY piece_file_toc_entries_insert ON piece_file_toc_entries
  FOR INSERT TO authenticated
  WITH CHECK (can_manage_piece_file_toc_entries(piece_file_id));

CREATE POLICY piece_file_toc_entries_update ON piece_file_toc_entries
  FOR UPDATE TO authenticated
  USING (can_manage_piece_file_toc_entries(piece_file_id))
  WITH CHECK (can_manage_piece_file_toc_entries(piece_file_id));

CREATE POLICY piece_file_toc_entries_delete ON piece_file_toc_entries
  FOR DELETE TO authenticated
  USING (can_manage_piece_file_toc_entries(piece_file_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON piece_file_toc_entries
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION can_manage_piece_file_toc_entries(UUID)
  TO authenticated, service_role;

-- Link program item units to TOC entries

ALTER TABLE program_item_units
  ADD COLUMN piece_file_toc_entry_id UUID
    REFERENCES piece_file_toc_entries (id) ON DELETE SET NULL;

CREATE INDEX program_item_units_toc_entry_idx
  ON program_item_units (piece_file_toc_entry_id)
  WHERE piece_file_toc_entry_id IS NOT NULL;

CREATE OR REPLACE FUNCTION check_program_item_unit_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_program_org UUID;
  v_file_org UUID;
  v_shortcut_org UUID;
  v_shortcut_file UUID;
  v_toc_org UUID;
  v_toc_file UUID;
BEGIN
  SELECT organization_id INTO v_program_org
  FROM program_items
  WHERE id = NEW.program_item_id;

  IF v_program_org IS NULL THEN
    RAISE EXCEPTION 'program_item_unit_invalid_program_item';
  END IF;

  IF v_program_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'program_item_unit_program_org_mismatch';
  END IF;

  SELECT organization_id INTO v_file_org FROM piece_files WHERE id = NEW.piece_file_id;

  IF v_file_org IS NULL THEN
    RAISE EXCEPTION 'program_item_unit_invalid_piece_file';
  END IF;

  IF v_file_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'program_item_unit_file_org_mismatch';
  END IF;

  IF NEW.navigation_shortcut_id IS NOT NULL THEN
    SELECT organization_id, piece_file_id
    INTO v_shortcut_org, v_shortcut_file
    FROM piece_file_navigation_shortcuts
    WHERE id = NEW.navigation_shortcut_id;

    IF v_shortcut_org IS NULL THEN
      RAISE EXCEPTION 'program_item_unit_invalid_navigation_shortcut';
    END IF;

    IF v_shortcut_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'program_item_unit_shortcut_org_mismatch';
    END IF;

    IF v_shortcut_file <> NEW.piece_file_id THEN
      RAISE EXCEPTION 'program_item_unit_shortcut_file_mismatch';
    END IF;
  END IF;

  IF NEW.piece_file_toc_entry_id IS NOT NULL THEN
    SELECT organization_id, piece_file_id
    INTO v_toc_org, v_toc_file
    FROM piece_file_toc_entries
    WHERE id = NEW.piece_file_toc_entry_id;

    IF v_toc_org IS NULL THEN
      RAISE EXCEPTION 'program_item_unit_invalid_toc_entry';
    END IF;

    IF v_toc_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'program_item_unit_toc_org_mismatch';
    END IF;

    IF v_toc_file <> NEW.piece_file_id THEN
      RAISE EXCEPTION 'program_item_unit_toc_file_mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
