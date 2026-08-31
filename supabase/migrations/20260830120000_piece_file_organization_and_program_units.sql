-- Piece file organization modes and granular program item units (lessons / page ranges)

CREATE TYPE piece_file_organization AS ENUM ('distributed', 'sequential', 'single');

ALTER TABLE pieces
  ADD COLUMN file_organization piece_file_organization NOT NULL DEFAULT 'single';

-- Backfill file_organization from existing files
UPDATE pieces p
SET file_organization = inferred.mode
FROM (
  SELECT
    pi.id AS piece_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM piece_files pf
        INNER JOIN piece_file_part_links pfpl ON pfpl.piece_file_id = pf.id
        WHERE pf.piece_id = pi.id
      ) THEN 'distributed'::piece_file_organization
      WHEN (
        SELECT COUNT(*)
        FROM piece_files pf
        WHERE pf.piece_id = pi.id
          AND pf.kind = 'score'
      ) > 1 THEN 'sequential'::piece_file_organization
      ELSE 'single'::piece_file_organization
    END AS mode
  FROM pieces pi
) AS inferred
WHERE p.id = inferred.piece_id;

ALTER TABLE piece_files
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0);

WITH ranked AS (
  SELECT
    pf.id,
    ROW_NUMBER() OVER (
      PARTITION BY pf.piece_id
      ORDER BY pf.created_at, pf.title, pf.id
    ) - 1 AS next_sort_order
  FROM piece_files pf
)
UPDATE piece_files pf
SET sort_order = ranked.next_sort_order
FROM ranked
WHERE pf.id = ranked.id;

CREATE INDEX piece_files_piece_sort_idx ON piece_files (piece_id, sort_order);

ALTER TABLE program_items
  DROP CONSTRAINT IF EXISTS program_items_event_id_piece_id_key;

CREATE TABLE program_item_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  program_item_id UUID NOT NULL REFERENCES program_items (id) ON DELETE CASCADE,
  piece_file_id UUID NOT NULL REFERENCES piece_files (id) ON DELETE RESTRICT,
  sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  start_page INT CHECK (start_page IS NULL OR start_page > 0),
  end_page INT CHECK (end_page IS NULL OR end_page > 0),
  navigation_shortcut_id UUID REFERENCES piece_file_navigation_shortcuts (id) ON DELETE SET NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT program_item_units_page_range_check CHECK (
    start_page IS NULL
    OR end_page IS NULL
    OR end_page >= start_page
  )
);

CREATE INDEX program_item_units_program_item_sort_idx
  ON program_item_units (program_item_id, sort_order);

CREATE INDEX program_item_units_piece_file_idx
  ON program_item_units (piece_file_id);

CREATE OR REPLACE FUNCTION check_program_item_unit_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_program_org UUID;
  v_file_org UUID;
  v_shortcut_org UUID;
  v_shortcut_file UUID;
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER program_item_units_check_org
  BEFORE INSERT OR UPDATE ON program_item_units
  FOR EACH ROW EXECUTE FUNCTION check_program_item_unit_org();

CREATE OR REPLACE FUNCTION check_program_item_unit_piece_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_program_piece UUID;
  v_file_piece UUID;
  v_file_kind piece_file_kind;
BEGIN
  SELECT piece_id INTO v_program_piece
  FROM program_items
  WHERE id = NEW.program_item_id;

  SELECT piece_id, kind INTO v_file_piece, v_file_kind
  FROM piece_files
  WHERE id = NEW.piece_file_id;

  IF v_program_piece IS NULL OR v_file_piece IS NULL THEN
    RAISE EXCEPTION 'program_item_unit_invalid_reference';
  END IF;

  IF v_program_piece <> v_file_piece THEN
    RAISE EXCEPTION 'program_item_unit_piece_mismatch';
  END IF;

  IF v_file_kind <> 'score' THEN
    RAISE EXCEPTION 'program_item_unit_requires_score';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER program_item_units_check_piece_match
  BEFORE INSERT OR UPDATE ON program_item_units
  FOR EACH ROW EXECUTE FUNCTION check_program_item_unit_piece_match();

ALTER TABLE program_item_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY program_item_units_select_visible ON program_item_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM program_items pi
      WHERE pi.id = program_item_id
        AND can_see_event(pi.event_id)
    )
  );

CREATE POLICY program_item_units_write_writer ON program_item_units
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM program_items pi
      WHERE pi.id = program_item_id
        AND can_write_event(pi.event_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM program_items pi
      WHERE pi.id = program_item_id
        AND can_write_event(pi.event_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON program_item_units
  TO authenticated, service_role;
