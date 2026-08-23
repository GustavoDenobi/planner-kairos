-- Independent audio access settings (group + piece) and enforcement by file kind

ALTER TABLE groups
  ADD COLUMN audio_access_scope piece_file_access_scope NOT NULL DEFAULT 'own_parts',
  ADD COLUMN audio_allow_download BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE pieces
  ADD COLUMN audio_access_scope piece_file_access_scope,
  ADD COLUMN audio_allow_download BOOLEAN;

UPDATE groups
SET
  audio_access_scope = file_access_scope,
  audio_allow_download = allow_file_download;

UPDATE pieces
SET
  audio_access_scope = file_access_scope,
  audio_allow_download = allow_file_download
WHERE file_access_scope IS NOT NULL OR allow_file_download IS NOT NULL;

CREATE OR REPLACE FUNCTION resolve_piece_audio_access(p_piece_id UUID)
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
    AND (v_piece.audio_access_scope IS NOT NULL OR v_piece.audio_allow_download IS NOT NULL);

  FOR rec IN
    SELECT
      g.audio_access_scope AS group_scope,
      g.audio_allow_download AS group_download
    FROM piece_groups pg
    INNER JOIN groups g ON g.id = pg.group_id
    INNER JOIN assignments a ON a.group_id = g.id
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE pg.piece_id = p_piece_id
      AND m.user_id = auth.uid()
  LOOP
    v_has_path := true;

    IF v_use_piece_rules THEN
      v_path_scope := COALESCE(v_piece.audio_access_scope, rec.group_scope);
      v_path_download := COALESCE(v_piece.audio_allow_download, rec.group_download);
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
      v_path_scope := COALESCE(v_piece.audio_access_scope, 'own_parts'::piece_file_access_scope);
      v_path_download := COALESCE(v_piece.audio_allow_download, true);
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

  IF v_file.kind = 'audio' THEN
    SELECT * INTO v_access
    FROM resolve_piece_audio_access(v_file.piece_id)
    LIMIT 1;
  ELSE
    SELECT * INTO v_access
    FROM resolve_piece_file_access(v_file.piece_id)
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_access.allow_download, false);
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_piece_audio_access(UUID) TO authenticated, service_role;
