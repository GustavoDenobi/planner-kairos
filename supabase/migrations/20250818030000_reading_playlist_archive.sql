-- Soft-archive event-sourced reading playlists after the event TTL.

ALTER TABLE reading_playlists
  ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX reading_playlists_org_owner_active_idx
  ON reading_playlists (organization_id, owner_user_id)
  WHERE archived_at IS NULL;

-- If the source event is deleted, archive related playlists before the FK is nulled.
CREATE OR REPLACE FUNCTION archive_reading_playlists_for_deleted_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE reading_playlists
  SET archived_at = COALESCE(archived_at, now())
  WHERE source_event_id = OLD.id
    AND archived_at IS NULL;

  RETURN OLD;
END;
$$;

CREATE TRIGGER events_archive_reading_playlists
  BEFORE DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION archive_reading_playlists_for_deleted_event();
