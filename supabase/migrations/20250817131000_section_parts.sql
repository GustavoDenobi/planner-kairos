-- Section–Part composition: which parts belong to each naipe (section).

CREATE TABLE section_parts (
  section_id UUID NOT NULL REFERENCES sections (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (section_id, part_id)
);

CREATE INDEX section_parts_part_id_idx ON section_parts (part_id);

-- Ensure section and part belong to the same organization as organization_id.
CREATE OR REPLACE FUNCTION check_section_part_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_section_org UUID;
  v_part_org UUID;
BEGIN
  SELECT organization_id INTO v_section_org
  FROM sections WHERE id = NEW.section_id;

  SELECT organization_id INTO v_part_org
  FROM parts WHERE id = NEW.part_id;

  IF v_section_org IS NULL OR v_part_org IS NULL THEN
    RAISE EXCEPTION 'section_part_invalid_reference';
  END IF;

  IF v_section_org <> NEW.organization_id OR v_part_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'section_part_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER section_parts_check_org
  BEFORE INSERT OR UPDATE ON section_parts
  FOR EACH ROW EXECUTE FUNCTION check_section_part_org();

-- Extend assignment validation: part must belong to section when both are set.
CREATE OR REPLACE FUNCTION check_assignment_references()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_musician_org UUID;
  v_group_org UUID;
  v_section_group UUID;
  v_section_org UUID;
  v_part_org UUID;
BEGIN
  SELECT organization_id INTO v_musician_org
  FROM musicians WHERE id = NEW.musician_id;

  SELECT organization_id INTO v_group_org
  FROM groups WHERE id = NEW.group_id;

  IF v_musician_org IS NULL OR v_group_org IS NULL THEN
    RAISE EXCEPTION 'assignment_invalid_reference';
  END IF;

  IF v_musician_org <> NEW.organization_id OR v_group_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'assignment_org_mismatch';
  END IF;

  IF NEW.section_id IS NOT NULL THEN
    SELECT group_id, organization_id INTO v_section_group, v_section_org
    FROM sections WHERE id = NEW.section_id;

    IF v_section_org IS NULL OR v_section_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'assignment_section_org_mismatch';
    END IF;

    IF v_section_group <> NEW.group_id THEN
      RAISE EXCEPTION 'assignment_section_group_mismatch';
    END IF;
  END IF;

  IF NEW.part_id IS NOT NULL THEN
    SELECT organization_id INTO v_part_org
    FROM parts WHERE id = NEW.part_id;

    IF v_part_org IS NULL OR v_part_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'assignment_part_org_mismatch';
    END IF;
  END IF;

  IF NEW.section_id IS NOT NULL AND NEW.part_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM section_parts sp
      WHERE sp.section_id = NEW.section_id
        AND sp.part_id = NEW.part_id
        AND sp.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'assignment_section_part_mismatch';
    END IF;
  END IF;

  IF NEW.ensemble_role = 'section_lead' AND NEW.section_id IS NULL THEN
    RAISE EXCEPTION 'section_lead_requires_section';
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE section_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY section_parts_select_member ON section_parts
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY section_parts_write_admin ON section_parts
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON section_parts TO authenticated, service_role;
GRANT SELECT ON section_parts TO anon;
