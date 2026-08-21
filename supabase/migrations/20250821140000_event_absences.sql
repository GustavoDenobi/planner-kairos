CREATE TABLE event_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  musician_id UUID NOT NULL REFERENCES musicians (id) ON DELETE CASCADE,
  marked_by UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, musician_id)
);

CREATE INDEX event_absences_event_id_idx ON event_absences (event_id);
CREATE INDEX event_absences_musician_id_idx ON event_absences (musician_id);

CREATE OR REPLACE FUNCTION check_event_absence_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_org UUID;
  v_musician_org UUID;
BEGIN
  SELECT organization_id INTO v_event_org FROM events WHERE id = NEW.event_id;
  SELECT organization_id INTO v_musician_org FROM musicians WHERE id = NEW.musician_id;

  IF v_event_org IS NULL THEN
    RAISE EXCEPTION 'event_absence_invalid_event';
  END IF;

  IF v_musician_org IS NULL THEN
    RAISE EXCEPTION 'event_absence_invalid_musician';
  END IF;

  IF v_event_org <> NEW.organization_id OR v_musician_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'event_absence_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER event_absences_check_org
  BEFORE INSERT OR UPDATE ON event_absences
  FOR EACH ROW EXECUTE FUNCTION check_event_absence_org();

ALTER TABLE event_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_absences_select_visible ON event_absences
  FOR SELECT TO authenticated
  USING (can_see_event(event_id));

CREATE POLICY event_absences_insert_writer ON event_absences
  FOR INSERT TO authenticated
  WITH CHECK (can_write_event(event_id));

CREATE POLICY event_absences_delete_writer ON event_absences
  FOR DELETE TO authenticated
  USING (can_write_event(event_id));
