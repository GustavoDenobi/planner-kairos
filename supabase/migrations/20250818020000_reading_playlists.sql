-- Reading playlists: personal ordered lists of score files for performance reading

CREATE TABLE reading_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_event_id UUID REFERENCES events (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reading_playlists_org_owner_idx ON reading_playlists (organization_id, owner_user_id);

CREATE TABLE reading_playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES reading_playlists (id) ON DELETE CASCADE,
  piece_file_id UUID NOT NULL REFERENCES piece_files (id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reading_playlist_items_playlist_sort_idx
  ON reading_playlist_items (playlist_id, sort_order);

CREATE TRIGGER reading_playlists_updated_at
  BEFORE UPDATE ON reading_playlists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Integrity: source event must belong to same org
CREATE OR REPLACE FUNCTION check_reading_playlist_source_event_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = NEW.source_event_id
      AND e.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'reading_playlist_source_event_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reading_playlists_check_source_event_org
  BEFORE INSERT OR UPDATE ON reading_playlists
  FOR EACH ROW EXECUTE FUNCTION check_reading_playlist_source_event_org();

-- Integrity: playlist item org must match playlist org
CREATE OR REPLACE FUNCTION check_reading_playlist_item_playlist_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_playlist_org UUID;
BEGIN
  SELECT organization_id INTO v_playlist_org
  FROM reading_playlists
  WHERE id = NEW.playlist_id;

  IF v_playlist_org IS NULL THEN
    RAISE EXCEPTION 'reading_playlist_item_invalid_playlist';
  END IF;

  IF v_playlist_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'reading_playlist_item_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reading_playlist_items_check_playlist_org
  BEFORE INSERT OR UPDATE ON reading_playlist_items
  FOR EACH ROW EXECUTE FUNCTION check_reading_playlist_item_playlist_org();

-- Integrity: piece file must be score and same org
CREATE OR REPLACE FUNCTION check_reading_playlist_item_file()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_file_org UUID;
  v_file_kind piece_file_kind;
BEGIN
  SELECT organization_id, kind INTO v_file_org, v_file_kind
  FROM piece_files
  WHERE id = NEW.piece_file_id;

  IF v_file_org IS NULL THEN
    RAISE EXCEPTION 'reading_playlist_item_invalid_file';
  END IF;

  IF v_file_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'reading_playlist_item_file_org_mismatch';
  END IF;

  IF v_file_kind <> 'score' THEN
    RAISE EXCEPTION 'reading_playlist_item_must_be_score';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reading_playlist_items_check_file
  BEFORE INSERT OR UPDATE ON reading_playlist_items
  FOR EACH ROW EXECUTE FUNCTION check_reading_playlist_item_file();

ALTER TABLE reading_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY reading_playlists_select ON reading_playlists
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id) AND owner_user_id = auth.uid());

CREATE POLICY reading_playlists_insert ON reading_playlists
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id) AND owner_user_id = auth.uid());

CREATE POLICY reading_playlists_update ON reading_playlists
  FOR UPDATE TO authenticated
  USING (is_org_member(organization_id) AND owner_user_id = auth.uid())
  WITH CHECK (is_org_member(organization_id) AND owner_user_id = auth.uid());

CREATE POLICY reading_playlists_delete ON reading_playlists
  FOR DELETE TO authenticated
  USING (is_org_member(organization_id) AND owner_user_id = auth.uid());

CREATE POLICY reading_playlist_items_select ON reading_playlist_items
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM reading_playlists p
      WHERE p.id = playlist_id
        AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY reading_playlist_items_insert ON reading_playlist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM reading_playlists p
      WHERE p.id = playlist_id
        AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY reading_playlist_items_update ON reading_playlist_items
  FOR UPDATE TO authenticated
  USING (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM reading_playlists p
      WHERE p.id = playlist_id
        AND p.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM reading_playlists p
      WHERE p.id = playlist_id
        AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY reading_playlist_items_delete ON reading_playlist_items
  FOR DELETE TO authenticated
  USING (
    is_org_member(organization_id)
    AND EXISTS (
      SELECT 1 FROM reading_playlists p
      WHERE p.id = playlist_id
        AND p.owner_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON reading_playlists TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON reading_playlist_items TO authenticated, service_role;
