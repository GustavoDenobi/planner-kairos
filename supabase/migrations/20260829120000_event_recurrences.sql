-- Event recurrences: series grouper with materialized occurrences

CREATE TABLE event_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES event_types (id) ON DELETE RESTRICT,
  title TEXT,
  location TEXT,
  notes TEXT,
  duration_minutes INT,
  series_starts_at TIMESTAMPTZ NOT NULL,
  series_ends_at TIMESTAMPTZ NOT NULL,
  rule JSONB NOT NULL,
  limit_anchor_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_recurrences_series_range CHECK (series_ends_at >= series_starts_at),
  CONSTRAINT event_recurrences_series_end_limit CHECK (
    series_ends_at <= (
      date_trunc('day', limit_anchor_at AT TIME ZONE 'UTC')
      + interval '730 days'
      + interval '1 day'
      - interval '1 second'
    )
  )
);

CREATE INDEX event_recurrences_org_cancelled_idx
  ON event_recurrences (organization_id, cancelled_at);

CREATE TRIGGER event_recurrences_updated_at
  BEFORE UPDATE ON event_recurrences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE event_recurrence_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  recurrence_id UUID NOT NULL REFERENCES event_recurrences (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recurrence_id, group_id)
);

CREATE INDEX event_recurrence_groups_recurrence_id_idx
  ON event_recurrence_groups (recurrence_id);

CREATE TABLE event_recurrence_musicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  recurrence_id UUID NOT NULL REFERENCES event_recurrences (id) ON DELETE CASCADE,
  musician_id UUID NOT NULL REFERENCES musicians (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recurrence_id, musician_id)
);

CREATE INDEX event_recurrence_musicians_recurrence_id_idx
  ON event_recurrence_musicians (recurrence_id);

ALTER TABLE events
  ADD COLUMN recurrence_id UUID REFERENCES event_recurrences (id) ON DELETE SET NULL,
  ADD COLUMN occurrence_index INT,
  ADD COLUMN original_starts_at TIMESTAMPTZ,
  ADD COLUMN is_exception BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX events_recurrence_starts_at_idx ON events (recurrence_id, starts_at);
CREATE INDEX events_recurrence_occurrence_idx ON events (recurrence_id, occurrence_index);

ALTER TABLE events
  ADD CONSTRAINT events_recurrence_occurrence_required CHECK (
    recurrence_id IS NULL
    OR (occurrence_index IS NOT NULL AND original_starts_at IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION check_event_recurrence_type_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM event_types t
    WHERE t.id = NEW.type_id
      AND t.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'event_recurrence_type_org_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_recurrences_check_type_org
  BEFORE INSERT OR UPDATE ON event_recurrences
  FOR EACH ROW EXECUTE FUNCTION check_event_recurrence_type_org();

CREATE OR REPLACE FUNCTION check_event_recurrence_group_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_recurrence_org UUID;
  v_group_org UUID;
BEGIN
  SELECT organization_id INTO v_recurrence_org
  FROM event_recurrences WHERE id = NEW.recurrence_id;
  SELECT organization_id INTO v_group_org FROM groups WHERE id = NEW.group_id;

  IF v_recurrence_org IS NULL OR v_group_org IS NULL THEN
    RAISE EXCEPTION 'event_recurrence_group_invalid';
  END IF;

  IF v_recurrence_org <> NEW.organization_id OR v_group_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'event_recurrence_group_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER event_recurrence_groups_check_org
  BEFORE INSERT OR UPDATE ON event_recurrence_groups
  FOR EACH ROW EXECUTE FUNCTION check_event_recurrence_group_org();

CREATE OR REPLACE FUNCTION check_event_recurrence_musician_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_recurrence_org UUID;
  v_musician_org UUID;
BEGIN
  SELECT organization_id INTO v_recurrence_org
  FROM event_recurrences WHERE id = NEW.recurrence_id;
  SELECT organization_id INTO v_musician_org FROM musicians WHERE id = NEW.musician_id;

  IF v_recurrence_org IS NULL OR v_musician_org IS NULL THEN
    RAISE EXCEPTION 'event_recurrence_musician_invalid';
  END IF;

  IF v_recurrence_org <> NEW.organization_id OR v_musician_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'event_recurrence_musician_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER event_recurrence_musicians_check_org
  BEFORE INSERT OR UPDATE ON event_recurrence_musicians
  FOR EACH ROW EXECUTE FUNCTION check_event_recurrence_musician_org();

CREATE OR REPLACE FUNCTION can_see_recurrence(p_recurrence_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM event_recurrences r
    WHERE r.id = p_recurrence_id
      AND is_org_member(r.organization_id)
      AND (
        has_org_role(r.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR r.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM event_recurrence_musicians rm
          INNER JOIN musicians m ON m.id = rm.musician_id
          WHERE rm.recurrence_id = r.id
            AND m.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM event_recurrence_groups rg
          INNER JOIN assignments a ON a.group_id = rg.group_id
          INNER JOIN musicians m ON m.id = a.musician_id
          WHERE rg.recurrence_id = r.id
            AND m.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM events e
          WHERE e.recurrence_id = r.id
            AND can_see_event(e.id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION can_write_recurrence(p_recurrence_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM event_recurrences r
    WHERE r.id = p_recurrence_id
      AND is_org_member(r.organization_id)
      AND (
        has_org_role(r.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR (
          is_teacher_in_org(r.organization_id)
          AND (
            r.created_by = auth.uid()
            OR EXISTS (
              SELECT 1
              FROM event_recurrence_groups rg
              WHERE rg.recurrence_id = r.id
                AND is_teacher_of_group(r.organization_id, rg.group_id)
            )
          )
        )
      )
  );
$$;

ALTER TABLE event_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_recurrence_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_recurrence_musicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_recurrences_select_visible ON event_recurrences
  FOR SELECT TO authenticated
  USING (can_see_recurrence(id));

CREATE POLICY event_recurrences_insert_admin_or_teacher ON event_recurrences
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_in_org(organization_id)
    )
  );

CREATE POLICY event_recurrences_update_writer ON event_recurrences
  FOR UPDATE TO authenticated
  USING (can_write_recurrence(id))
  WITH CHECK (can_write_recurrence(id));

CREATE POLICY event_recurrences_delete_writer ON event_recurrences
  FOR DELETE TO authenticated
  USING (can_write_recurrence(id));

CREATE POLICY event_recurrence_groups_select_visible ON event_recurrence_groups
  FOR SELECT TO authenticated
  USING (can_see_recurrence(recurrence_id));

CREATE POLICY event_recurrence_groups_write_writer ON event_recurrence_groups
  FOR ALL TO authenticated
  USING (can_write_recurrence(recurrence_id))
  WITH CHECK (
    can_write_recurrence(recurrence_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_of_group(organization_id, group_id)
    )
  );

CREATE POLICY event_recurrence_musicians_select_visible ON event_recurrence_musicians
  FOR SELECT TO authenticated
  USING (can_see_recurrence(recurrence_id));

CREATE POLICY event_recurrence_musicians_write_writer ON event_recurrence_musicians
  FOR ALL TO authenticated
  USING (can_write_recurrence(recurrence_id))
  WITH CHECK (
    can_write_recurrence(recurrence_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR EXISTS (
        SELECT 1 FROM musicians m
        WHERE m.id = musician_id
          AND m.user_id = auth.uid()
      )
      OR musician_in_teacher_groups(organization_id, musician_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON event_recurrences, event_recurrence_groups, event_recurrence_musicians
  TO authenticated, service_role;
GRANT SELECT ON event_recurrences, event_recurrence_groups, event_recurrence_musicians TO anon;

GRANT EXECUTE ON FUNCTION can_see_recurrence(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_write_recurrence(UUID) TO authenticated, service_role;
