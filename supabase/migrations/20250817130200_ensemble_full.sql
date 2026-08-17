-- Ensemble full schema: parts, part_divisions, sections, assignment constraints
-- Version 20250817130200: supersedes skipped 20250817130000 (was consumed by groups_archive).

CREATE TYPE part_kind AS ENUM ('instrument', 'voice');

CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind part_kind NOT NULL,
  family TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE part_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (part_id, name)
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, name)
);

CREATE TRIGGER parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER part_divisions_updated_at
  BEFORE UPDATE ON part_divisions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sections_updated_at
  BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ensure part_divisions belong to same org as part
CREATE OR REPLACE FUNCTION check_part_division_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM parts p
    WHERE p.id = NEW.part_id
      AND p.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'part_division_org_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER part_divisions_check_org
  BEFORE INSERT OR UPDATE ON part_divisions
  FOR EACH ROW EXECUTE FUNCTION check_part_division_org();

-- Ensure sections belong to same org as group
CREATE OR REPLACE FUNCTION check_section_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = NEW.group_id
      AND g.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'section_org_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sections_check_org
  BEFORE INSERT OR UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION check_section_org();

-- Assignment FKs and constraints
ALTER TABLE assignments
  ADD CONSTRAINT assignments_section_id_fkey
  FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE SET NULL;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_part_id_fkey
  FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE SET NULL;

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

  IF NEW.ensemble_role = 'section_lead' AND NEW.section_id IS NULL THEN
    RAISE EXCEPTION 'section_lead_requires_section';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assignments_check_references
  BEFORE INSERT OR UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION check_assignment_references();

CREATE UNIQUE INDEX assignments_unique_combo ON assignments (
  musician_id,
  group_id,
  COALESCE(section_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(part_id, '00000000-0000-0000-0000-000000000000'),
  ensemble_role
);

-- RLS
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY parts_select_member ON parts
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY parts_write_admin ON parts
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY part_divisions_select_member ON part_divisions
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY part_divisions_write_admin ON part_divisions
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY sections_select_member ON sections
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY sections_write_admin ON sections
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

GRANT USAGE ON TYPE part_kind TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON parts, part_divisions, sections TO authenticated, service_role;
GRANT SELECT ON parts, part_divisions, sections TO anon;
