-- Piece file access: group/piece settings, audience links, and RLS

CREATE TYPE piece_file_access_scope AS ENUM ('own_parts', 'all_files');

ALTER TABLE groups
  ADD COLUMN file_access_scope piece_file_access_scope NOT NULL DEFAULT 'own_parts',
  ADD COLUMN allow_file_download BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN allow_piece_access_override BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE pieces
  ADD COLUMN file_access_scope piece_file_access_scope,
  ADD COLUMN allow_file_download BOOLEAN;

CREATE TABLE piece_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES pieces (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (piece_id, group_id)
);

CREATE INDEX piece_groups_piece_id_idx ON piece_groups (piece_id);
CREATE INDEX piece_groups_group_id_idx ON piece_groups (group_id);

CREATE TABLE piece_musicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES pieces (id) ON DELETE CASCADE,
  musician_id UUID NOT NULL REFERENCES musicians (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (piece_id, musician_id)
);

CREATE INDEX piece_musicians_piece_id_idx ON piece_musicians (piece_id);
CREATE INDEX piece_musicians_musician_id_idx ON piece_musicians (musician_id);

CREATE OR REPLACE FUNCTION check_piece_group_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_piece_org UUID;
  v_group_org UUID;
BEGIN
  SELECT organization_id INTO v_piece_org FROM pieces WHERE id = NEW.piece_id;
  SELECT organization_id INTO v_group_org FROM groups WHERE id = NEW.group_id;

  IF v_piece_org IS NULL THEN
    RAISE EXCEPTION 'piece_group_invalid_piece';
  END IF;

  IF v_group_org IS NULL THEN
    RAISE EXCEPTION 'piece_group_invalid_group';
  END IF;

  IF v_piece_org <> NEW.organization_id OR v_group_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_group_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_groups_check_org
  BEFORE INSERT OR UPDATE ON piece_groups
  FOR EACH ROW EXECUTE FUNCTION check_piece_group_org();

CREATE OR REPLACE FUNCTION check_piece_musician_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_piece_org UUID;
  v_musician_org UUID;
BEGIN
  SELECT organization_id INTO v_piece_org FROM pieces WHERE id = NEW.piece_id;
  SELECT organization_id INTO v_musician_org FROM musicians WHERE id = NEW.musician_id;

  IF v_piece_org IS NULL THEN
    RAISE EXCEPTION 'piece_musician_invalid_piece';
  END IF;

  IF v_musician_org IS NULL THEN
    RAISE EXCEPTION 'piece_musician_invalid_musician';
  END IF;

  IF v_piece_org <> NEW.organization_id OR v_musician_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_musician_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_musicians_check_org
  BEFORE INSERT OR UPDATE ON piece_musicians
  FOR EACH ROW EXECUTE FUNCTION check_piece_musician_org();

CREATE OR REPLACE FUNCTION piece_has_audience(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM piece_groups WHERE piece_id = p_piece_id
  )
  OR EXISTS (
    SELECT 1 FROM piece_musicians WHERE piece_id = p_piece_id
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
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION is_conductor_for_piece(p_piece_id UUID)
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
      AND a.ensemble_role = 'conductor'
  );
$$;

CREATE OR REPLACE FUNCTION piece_allows_override(p_piece_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM piece_groups pg
    INNER JOIN groups g ON g.id = pg.group_id
    WHERE pg.piece_id = p_piece_id
      AND g.allow_piece_access_override = true
  );
$$;

CREATE OR REPLACE FUNCTION resolve_piece_file_access(p_piece_id UUID)
RETURNS TABLE (
  scope piece_file_access_scope,
  allow_download BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_piece pieces%ROWTYPE;
  v_use_piece_rules BOOLEAN;
  v_scope piece_file_access_scope := 'own_parts';
  v_allow_download BOOLEAN := false;
  v_path_scope piece_file_access_scope;
  v_path_download BOOLEAN;
  v_has_path BOOLEAN := false;
  rec RECORD;
BEGIN
  SELECT * INTO v_piece FROM pieces WHERE id = p_piece_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF has_org_role(v_piece.organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    scope := 'all_files';
    allow_download := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT can_see_piece(p_piece_id) THEN
    RETURN;
  END IF;

  v_use_piece_rules := piece_allows_override(p_piece_id)
    AND (v_piece.file_access_scope IS NOT NULL OR v_piece.allow_file_download IS NOT NULL);

  FOR rec IN
    SELECT
      g.file_access_scope AS group_scope,
      g.allow_file_download AS group_download
    FROM piece_groups pg
    INNER JOIN groups g ON g.id = pg.group_id
    INNER JOIN assignments a ON a.group_id = g.id
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE pg.piece_id = p_piece_id
      AND m.user_id = auth.uid()
  LOOP
    v_has_path := true;

    IF v_use_piece_rules THEN
      v_path_scope := COALESCE(v_piece.file_access_scope, rec.group_scope);
      v_path_download := COALESCE(v_piece.allow_file_download, rec.group_download);
    ELSE
      v_path_scope := rec.group_scope;
      v_path_download := rec.group_download;
    END IF;

    IF v_path_scope = 'all_files' THEN
      v_scope := 'all_files';
    END IF;

    IF v_path_download THEN
      v_allow_download := true;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM piece_musicians pm
    INNER JOIN musicians m ON m.id = pm.musician_id
    WHERE pm.piece_id = p_piece_id
      AND m.user_id = auth.uid()
  ) THEN
    v_has_path := true;

    IF v_use_piece_rules THEN
      v_path_scope := COALESCE(v_piece.file_access_scope, 'own_parts'::piece_file_access_scope);
      v_path_download := COALESCE(v_piece.allow_file_download, true);
    ELSE
      v_path_scope := 'own_parts';
      v_path_download := true;
    END IF;

    IF v_path_scope = 'all_files' THEN
      v_scope := 'all_files';
    END IF;

    IF v_path_download THEN
      v_allow_download := true;
    END IF;
  END IF;

  IF v_has_path THEN
    scope := v_scope;
    allow_download := v_allow_download;
    RETURN NEXT;
  END IF;
END;
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

  SELECT * INTO v_access
  FROM resolve_piece_file_access(v_file.piece_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_access.scope = 'all_files' THEN
    RETURN true;
  END IF;

  IF v_file.kind = 'audio' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM piece_file_part_links WHERE piece_file_id = p_piece_file_id
  ) THEN
    RETURN is_conductor_for_piece(v_file.piece_id);
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

CREATE OR REPLACE FUNCTION can_download_piece_file(p_piece_file_id UUID)
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
  IF NOT can_access_piece_file(p_piece_file_id) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_file FROM piece_files WHERE id = p_piece_file_id;

  IF has_org_role(v_file.organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RETURN true;
  END IF;

  SELECT * INTO v_access
  FROM resolve_piece_file_access(v_file.piece_id)
  LIMIT 1;

  RETURN COALESCE(v_access.allow_download, false);
END;
$$;

CREATE OR REPLACE FUNCTION storage_piece_file_id_from_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (split_part(split_part(p_name, '/', 4), '-', 1))::UUID;
$$;

-- RLS updates
DROP POLICY IF EXISTS pieces_select_member ON pieces;
DROP POLICY IF EXISTS piece_files_select_member ON piece_files;
DROP POLICY IF EXISTS piece_file_part_links_select_member ON piece_file_part_links;
DROP POLICY IF EXISTS org_assets_select_member ON storage.objects;

CREATE POLICY pieces_select_visible ON pieces
  FOR SELECT TO authenticated
  USING (can_see_piece(id));

CREATE POLICY piece_files_select_visible ON piece_files
  FOR SELECT TO authenticated
  USING (can_access_piece_file(id));

CREATE POLICY piece_file_part_links_select_visible ON piece_file_part_links
  FOR SELECT TO authenticated
  USING (can_access_piece_file(piece_file_id));

ALTER TABLE piece_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_musicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY piece_groups_select_visible ON piece_groups
  FOR SELECT TO authenticated
  USING (can_see_piece(piece_id));

CREATE POLICY piece_groups_write_admin ON piece_groups
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY piece_musicians_select_visible ON piece_musicians
  FOR SELECT TO authenticated
  USING (can_see_piece(piece_id));

CREATE POLICY piece_musicians_write_admin ON piece_musicians
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY org_assets_select_member ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND is_org_member(storage_org_id_from_path(name))
    AND (
      name NOT LIKE storage_org_id_from_path(name)::TEXT || '/pieces/%'
      OR can_access_piece_file(storage_piece_file_id_from_path(name))
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON piece_groups, piece_musicians
  TO authenticated, service_role;
GRANT SELECT ON piece_groups, piece_musicians TO anon;

GRANT USAGE ON TYPE piece_file_access_scope TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION piece_has_audience(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_see_piece(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_conductor_for_piece(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION piece_allows_override(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resolve_piece_file_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_access_piece_file(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_download_piece_file(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage_piece_file_id_from_path(TEXT) TO authenticated, service_role;
