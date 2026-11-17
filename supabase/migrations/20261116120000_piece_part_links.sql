-- Piece-level part links: hide a whole work from musicians whose assignment
-- does not match, while teachers and conductors of a linked group still see it.
-- Score/audio files with no part links inherit these parts.

CREATE TABLE piece_part_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES pieces (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts (id) ON DELETE CASCADE,
  part_division_id UUID REFERENCES part_divisions (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX piece_part_links_unique_combo ON piece_part_links (
  piece_id,
  part_id,
  COALESCE(part_division_id, '00000000-0000-0000-0000-000000000000')
);

CREATE INDEX piece_part_links_part_id_idx ON piece_part_links (part_id);
CREATE INDEX piece_part_links_piece_id_idx ON piece_part_links (piece_id);

CREATE OR REPLACE FUNCTION check_piece_part_link_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_piece_org UUID;
  v_part_org UUID;
  v_division_part UUID;
  v_division_org UUID;
BEGIN
  SELECT organization_id INTO v_piece_org FROM pieces WHERE id = NEW.piece_id;
  SELECT organization_id INTO v_part_org FROM parts WHERE id = NEW.part_id;

  IF v_piece_org IS NULL OR v_piece_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_part_link_piece_org_mismatch';
  END IF;

  IF v_part_org IS NULL OR v_part_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_part_link_part_org_mismatch';
  END IF;

  IF NEW.part_division_id IS NOT NULL THEN
    SELECT part_id, organization_id INTO v_division_part, v_division_org
    FROM part_divisions WHERE id = NEW.part_division_id;

    IF v_division_org IS NULL OR v_division_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'piece_part_link_division_org_mismatch';
    END IF;

    IF v_division_part <> NEW.part_id THEN
      RAISE EXCEPTION 'piece_part_link_division_part_mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_part_links_check_org
  BEFORE INSERT OR UPDATE ON piece_part_links
  FOR EACH ROW EXECUTE FUNCTION check_piece_part_link_org();

CREATE OR REPLACE FUNCTION piece_has_part_restrictions(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM piece_part_links WHERE piece_id = p_piece_id
  );
$$;

CREATE OR REPLACE FUNCTION user_matches_piece_parts(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM piece_part_links ppl
    INNER JOIN pieces p ON p.id = ppl.piece_id
    INNER JOIN assignments a
      ON a.part_id = ppl.part_id
      AND a.organization_id = p.organization_id
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE ppl.piece_id = p_piece_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_group_writer_for_piece(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM piece_groups pg
    INNER JOIN assignments a ON a.group_id = pg.group_id
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE pg.piece_id = p_piece_id
      AND m.user_id = auth.uid()
      AND a.ensemble_role IN ('conductor', 'teacher')
  );
$$;

CREATE OR REPLACE FUNCTION can_see_piece(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pieces p
    WHERE p.id = p_piece_id
      AND p.deleted_at IS NULL
      AND is_org_member(p.organization_id)
      AND (
        has_org_role(p.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR (
          piece_has_audience(p.id)
          AND (
            EXISTS (
              SELECT 1
              FROM piece_musicians pm
              INNER JOIN musicians m ON m.id = pm.musician_id
              WHERE pm.piece_id = p.id
                AND m.user_id = auth.uid()
            )
            OR EXISTS (
              SELECT 1
              FROM piece_groups pg
              INNER JOIN assignments a ON a.group_id = pg.group_id
              INNER JOIN musicians m ON m.id = a.musician_id
              WHERE pg.piece_id = p.id
                AND m.user_id = auth.uid()
            )
          )
          AND (
            NOT piece_has_part_restrictions(p.id)
            OR is_group_writer_for_piece(p.id)
            OR user_matches_piece_parts(p.id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION can_access_piece_file(p_piece_file_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file piece_files%ROWTYPE;
  v_access RECORD;
BEGIN
  SELECT * INTO v_file FROM piece_files WHERE id = p_piece_file_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF has_org_role(v_file.organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RETURN true;
  END IF;

  IF v_file.kind = 'audio' THEN
    SELECT * INTO v_access
    FROM resolve_piece_audio_access(v_file.piece_id)
    LIMIT 1;
  ELSE
    SELECT * INTO v_access
    FROM resolve_piece_file_access(v_file.piece_id)
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_access.scope = 'all_files' THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM piece_file_part_links WHERE piece_file_id = p_piece_file_id
  ) THEN
    IF is_group_writer_for_piece(v_file.piece_id) THEN
      RETURN true;
    END IF;

    IF piece_has_part_restrictions(v_file.piece_id) THEN
      RETURN user_matches_piece_parts(v_file.piece_id);
    END IF;

    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM piece_file_part_links pfpl
    INNER JOIN assignments a
      ON a.part_id = pfpl.part_id
      AND a.organization_id = v_file.organization_id
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE pfpl.piece_file_id = p_piece_file_id
      AND m.user_id = auth.uid()
  );
END;
$$;

ALTER TABLE piece_part_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY piece_part_links_select_visible ON piece_part_links
  FOR SELECT TO authenticated
  USING (can_see_piece(piece_id));

CREATE POLICY piece_part_links_write_admin ON piece_part_links
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON piece_part_links TO authenticated, service_role;
GRANT SELECT ON piece_part_links TO anon;

GRANT EXECUTE ON FUNCTION piece_has_part_restrictions(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION user_matches_piece_parts(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_group_writer_for_piece(UUID) TO authenticated, service_role;
