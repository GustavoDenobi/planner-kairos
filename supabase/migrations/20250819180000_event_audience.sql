-- Event audience: group/musician associations and visibility

ALTER TABLE events
  ADD COLUMN created_by UUID REFERENCES profiles (id) ON DELETE SET NULL;

ALTER TABLE events
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE INDEX events_created_by_idx ON events (created_by);

CREATE TABLE event_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, group_id)
);

CREATE INDEX event_groups_event_id_idx ON event_groups (event_id);
CREATE INDEX event_groups_group_id_idx ON event_groups (group_id);

CREATE TABLE event_musicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  musician_id UUID NOT NULL REFERENCES musicians (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, musician_id)
);

CREATE INDEX event_musicians_event_id_idx ON event_musicians (event_id);
CREATE INDEX event_musicians_musician_id_idx ON event_musicians (musician_id);

CREATE OR REPLACE FUNCTION check_event_group_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_org UUID;
  v_group_org UUID;
BEGIN
  SELECT organization_id INTO v_event_org FROM events WHERE id = NEW.event_id;
  SELECT organization_id INTO v_group_org FROM groups WHERE id = NEW.group_id;

  IF v_event_org IS NULL THEN
    RAISE EXCEPTION 'event_group_invalid_event';
  END IF;

  IF v_group_org IS NULL THEN
    RAISE EXCEPTION 'event_group_invalid_group';
  END IF;

  IF v_event_org <> NEW.organization_id OR v_group_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'event_group_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER event_groups_check_org
  BEFORE INSERT OR UPDATE ON event_groups
  FOR EACH ROW EXECUTE FUNCTION check_event_group_org();

CREATE OR REPLACE FUNCTION check_event_musician_org()
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
    RAISE EXCEPTION 'event_musician_invalid_event';
  END IF;

  IF v_musician_org IS NULL THEN
    RAISE EXCEPTION 'event_musician_invalid_musician';
  END IF;

  IF v_event_org <> NEW.organization_id OR v_musician_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'event_musician_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER event_musicians_check_org
  BEFORE INSERT OR UPDATE ON event_musicians
  FOR EACH ROW EXECUTE FUNCTION check_event_musician_org();

CREATE OR REPLACE FUNCTION add_event_creator_musician()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_musician_id UUID;
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_musician_id
  FROM musicians
  WHERE organization_id = NEW.organization_id
    AND user_id = NEW.created_by;

  IF v_musician_id IS NOT NULL THEN
    INSERT INTO event_musicians (organization_id, event_id, musician_id)
    VALUES (NEW.organization_id, NEW.id, v_musician_id)
    ON CONFLICT (event_id, musician_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER events_add_creator_musician
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION add_event_creator_musician();

CREATE OR REPLACE FUNCTION is_teacher_in_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments a
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE a.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND a.ensemble_role = 'teacher'
  );
$$;

CREATE OR REPLACE FUNCTION is_teacher_of_group(p_org_id UUID, p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments a
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE a.organization_id = p_org_id
      AND a.group_id = p_group_id
      AND m.user_id = auth.uid()
      AND a.ensemble_role = 'teacher'
  );
$$;

CREATE OR REPLACE FUNCTION musician_in_teacher_groups(p_org_id UUID, p_musician_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments peer
    INNER JOIN assignments teacher
      ON teacher.group_id = peer.group_id
      AND teacher.organization_id = peer.organization_id
      AND teacher.ensemble_role = 'teacher'
    INNER JOIN musicians me ON me.id = teacher.musician_id
    WHERE peer.musician_id = p_musician_id
      AND peer.organization_id = p_org_id
      AND me.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION can_see_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM events e
    WHERE e.id = p_event_id
      AND is_org_member(e.organization_id)
      AND (
        has_org_role(e.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR e.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM event_musicians em
          INNER JOIN musicians m ON m.id = em.musician_id
          WHERE em.event_id = e.id
            AND m.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM event_groups eg
          INNER JOIN assignments a ON a.group_id = eg.group_id
          INNER JOIN musicians m ON m.id = a.musician_id
          WHERE eg.event_id = e.id
            AND m.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION can_write_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM events e
    WHERE e.id = p_event_id
      AND is_org_member(e.organization_id)
      AND (
        has_org_role(e.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR (
          is_teacher_in_org(e.organization_id)
          AND (
            e.created_by = auth.uid()
            OR EXISTS (
              SELECT 1
              FROM event_groups eg
              WHERE eg.event_id = e.id
                AND is_teacher_of_group(e.organization_id, eg.group_id)
            )
          )
        )
      )
  );
$$;

DROP POLICY IF EXISTS events_select_member ON events;
DROP POLICY IF EXISTS events_write_admin ON events;
DROP POLICY IF EXISTS program_items_select_member ON program_items;
DROP POLICY IF EXISTS program_items_write_admin ON program_items;

CREATE POLICY events_select_visible ON events
  FOR SELECT TO authenticated
  USING (can_see_event(id));

CREATE POLICY events_insert_admin_or_teacher ON events
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_in_org(organization_id)
    )
  );

CREATE POLICY events_update_writer ON events
  FOR UPDATE TO authenticated
  USING (can_write_event(id))
  WITH CHECK (can_write_event(id));

CREATE POLICY events_delete_writer ON events
  FOR DELETE TO authenticated
  USING (can_write_event(id));

CREATE POLICY program_items_select_visible ON program_items
  FOR SELECT TO authenticated
  USING (can_see_event(event_id));

CREATE POLICY program_items_write_writer ON program_items
  FOR ALL TO authenticated
  USING (can_write_event(event_id))
  WITH CHECK (can_write_event(event_id));

ALTER TABLE event_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_musicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_groups_select_visible ON event_groups
  FOR SELECT TO authenticated
  USING (can_see_event(event_id));

CREATE POLICY event_groups_insert_writer ON event_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    can_write_event(event_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_of_group(organization_id, group_id)
    )
  );

CREATE POLICY event_groups_update_writer ON event_groups
  FOR UPDATE TO authenticated
  USING (can_write_event(event_id))
  WITH CHECK (
    can_write_event(event_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_of_group(organization_id, group_id)
    )
  );

CREATE POLICY event_groups_delete_writer ON event_groups
  FOR DELETE TO authenticated
  USING (can_write_event(event_id));

CREATE POLICY event_musicians_select_visible ON event_musicians
  FOR SELECT TO authenticated
  USING (can_see_event(event_id));

CREATE POLICY event_musicians_insert_writer ON event_musicians
  FOR INSERT TO authenticated
  WITH CHECK (
    can_write_event(event_id)
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

CREATE POLICY event_musicians_update_writer ON event_musicians
  FOR UPDATE TO authenticated
  USING (can_write_event(event_id))
  WITH CHECK (
    can_write_event(event_id)
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

CREATE POLICY event_musicians_delete_writer ON event_musicians
  FOR DELETE TO authenticated
  USING (can_write_event(event_id));

CREATE POLICY musicians_select_teacher_group ON musicians
  FOR SELECT TO authenticated
  USING (musician_in_teacher_groups(organization_id, id));

CREATE POLICY musicians_select_event_participant ON musicians
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM event_musicians em
      WHERE em.musician_id = id
        AND can_see_event(em.event_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON event_groups, event_musicians
  TO authenticated, service_role;
GRANT SELECT ON event_groups, event_musicians TO anon;

GRANT EXECUTE ON FUNCTION is_teacher_in_org(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_teacher_of_group(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION musician_in_teacher_groups(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_see_event(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_write_event(UUID) TO authenticated, service_role;
