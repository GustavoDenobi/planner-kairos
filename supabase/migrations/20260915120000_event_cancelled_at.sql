ALTER TABLE events
  ADD COLUMN cancelled_at TIMESTAMPTZ;

CREATE INDEX events_cancelled_at_idx ON events (organization_id, cancelled_at)
  WHERE cancelled_at IS NOT NULL;
