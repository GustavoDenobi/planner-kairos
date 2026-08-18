-- Agenda: event types, events, and program items

CREATE TYPE event_kind AS ENUM ('rehearsal', 'service', 'class', 'special');

CREATE TABLE event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind event_kind NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES event_types (id) ON DELETE RESTRICT,
  title TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_org_starts_at_idx ON events (organization_id, starts_at);

CREATE TABLE program_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES pieces (id) ON DELETE RESTRICT,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, piece_id)
);

CREATE INDEX program_items_piece_id_idx ON program_items (piece_id);
CREATE INDEX program_items_event_id_idx ON program_items (event_id, sort_order);

-- updated_at triggers
CREATE TRIGGER event_types_updated_at
  BEFORE UPDATE ON event_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Integrity: event type must belong to same org
CREATE OR REPLACE FUNCTION check_event_type_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM event_types t
    WHERE t.id = NEW.type_id
      AND t.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'event_type_org_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_check_type_org
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION check_event_type_org();

-- Integrity: program item event same org
CREATE OR REPLACE FUNCTION check_program_item_event_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_org UUID;
BEGIN
  SELECT organization_id INTO v_event_org FROM events WHERE id = NEW.event_id;

  IF v_event_org IS NULL THEN
    RAISE EXCEPTION 'program_item_invalid_event';
  END IF;

  IF v_event_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'program_item_event_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER program_items_check_event_org
  BEFORE INSERT OR UPDATE ON program_items
  FOR EACH ROW EXECUTE FUNCTION check_program_item_event_org();

-- Integrity: program item piece same org
CREATE OR REPLACE FUNCTION check_program_item_piece_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_piece_org UUID;
BEGIN
  SELECT organization_id INTO v_piece_org FROM pieces WHERE id = NEW.piece_id;

  IF v_piece_org IS NULL THEN
    RAISE EXCEPTION 'program_item_invalid_piece';
  END IF;

  IF v_piece_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'program_item_piece_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER program_items_check_piece_org
  BEFORE INSERT OR UPDATE ON program_items
  FOR EACH ROW EXECUTE FUNCTION check_program_item_piece_org();

-- Integrity: cannot add soft-deleted pieces to program
CREATE OR REPLACE FUNCTION check_program_item_piece_not_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_at TIMESTAMPTZ;
BEGIN
  SELECT deleted_at INTO v_deleted_at FROM pieces WHERE id = NEW.piece_id;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'program_item_piece_deleted';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER program_items_check_piece_not_deleted
  BEFORE INSERT OR UPDATE ON program_items
  FOR EACH ROW EXECUTE FUNCTION check_program_item_piece_not_deleted();

-- Seed default event types for an organization
CREATE OR REPLACE FUNCTION seed_event_types(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO event_types (organization_id, name, kind, sort_order, color)
  VALUES
    (p_org_id, 'Ensaio de sábado', 'rehearsal', 1, 'blue-500'),
    (p_org_id, 'Ensaio de domingo', 'rehearsal', 2, 'sky-500'),
    (p_org_id, 'Culto de terça', 'service', 3, 'amber-500'),
    (p_org_id, 'Culto de sábado', 'service', 4, 'orange-500'),
    (p_org_id, 'Culto de domingo', 'service', 5, 'rose-500'),
    (p_org_id, 'Culto de ceia', 'service', 6, 'violet-500'),
    (p_org_id, 'Aula', 'class', 7, 'emerald-500'),
    (p_org_id, 'Congresso / evento especial', 'special', 8, 'fuchsia-500')
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION seed_event_types_on_org_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_event_types(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_seed_event_types
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_event_types_on_org_insert();

-- Backfill existing organizations
DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    PERFORM seed_event_types(v_org.id);
  END LOOP;
END;
$$;

-- RLS
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_types_select_member ON event_types
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY event_types_write_admin ON event_types
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY events_select_member ON events
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY events_write_admin ON events
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY program_items_select_member ON program_items
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY program_items_write_admin ON program_items
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

GRANT USAGE ON TYPE event_kind TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_types, events, program_items
  TO authenticated, service_role;
GRANT SELECT ON event_types, events, program_items TO anon;

GRANT EXECUTE ON FUNCTION seed_event_types(UUID) TO authenticated, service_role;
