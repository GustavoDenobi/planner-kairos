-- Subscription plans and org limits

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  max_groups INT,
  max_musicians INT,
  max_pieces INT,
  max_storage_bytes BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO plans (
  id,
  name,
  slug,
  description,
  max_groups,
  max_musicians,
  max_pieces,
  max_storage_bytes,
  is_active,
  sort_order
)
VALUES (
  'f0000000-0000-4000-8000-000000000001',
  'Gratuito',
  'gratuito',
  'Plano inicial para desenvolvimento e organizações pequenas',
  10,
  100,
  500,
  1073741824,
  true,
  0
);

ALTER TABLE organizations
  ADD COLUMN plan_id UUID NOT NULL
    REFERENCES plans (id) ON DELETE RESTRICT
    DEFAULT 'f0000000-0000-4000-8000-000000000001';

ALTER TABLE organizations
  ALTER COLUMN plan_id DROP DEFAULT;

CREATE INDEX organizations_plan_id_idx ON organizations (plan_id);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_select_authenticated ON plans
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION get_org_storage_bytes(p_org_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_piece_bytes BIGINT;
  v_storage_bytes BIGINT;
BEGIN
  SELECT COALESCE(SUM(byte_size), 0)
  INTO v_piece_bytes
  FROM piece_files
  WHERE organization_id = p_org_id;

  SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0)
  INTO v_storage_bytes
  FROM storage.objects
  WHERE bucket_id = 'org-assets'
    AND name LIKE p_org_id::TEXT || '/%';

  RETURN COALESCE(v_piece_bytes, 0) + COALESCE(v_storage_bytes, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_org_plan_usage(p_org_id UUID)
RETURNS TABLE (
  groups_count INT,
  musicians_count INT,
  pieces_count INT,
  events_count INT,
  storage_bytes BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::INT FROM groups WHERE organization_id = p_org_id AND archived_at IS NULL),
    (SELECT COUNT(*)::INT FROM musicians WHERE organization_id = p_org_id),
    (SELECT COUNT(*)::INT FROM pieces WHERE organization_id = p_org_id AND deleted_at IS NULL),
    (SELECT COUNT(*)::INT FROM events WHERE organization_id = p_org_id),
    get_org_storage_bytes(p_org_id);
$$;

CREATE OR REPLACE FUNCTION assert_org_plan_limit(
  p_org_id UUID,
  p_resource TEXT,
  p_delta BIGINT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plans%ROWTYPE;
  v_usage RECORD;
  v_current BIGINT;
  v_limit BIGINT;
BEGIN
  IF is_platform_admin() THEN
    RETURN;
  END IF;

  SELECT p.*
  INTO v_plan
  FROM organizations o
  JOIN plans p ON p.id = o.plan_id
  WHERE o.id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  SELECT * INTO v_usage FROM get_org_plan_usage(p_org_id);

  IF p_resource = 'groups' THEN
    v_current := v_usage.groups_count;
    v_limit := v_plan.max_groups;
    IF v_limit IS NOT NULL AND v_current + p_delta > v_limit THEN
      RAISE EXCEPTION 'plan_limit_groups';
    END IF;
  ELSIF p_resource = 'musicians' THEN
    v_current := v_usage.musicians_count;
    v_limit := v_plan.max_musicians;
    IF v_limit IS NOT NULL AND v_current + p_delta > v_limit THEN
      RAISE EXCEPTION 'plan_limit_musicians';
    END IF;
  ELSIF p_resource = 'pieces' THEN
    v_current := v_usage.pieces_count;
    v_limit := v_plan.max_pieces;
    IF v_limit IS NOT NULL AND v_current + p_delta > v_limit THEN
      RAISE EXCEPTION 'plan_limit_pieces';
    END IF;
  ELSIF p_resource = 'storage' THEN
    v_current := v_usage.storage_bytes;
    v_limit := v_plan.max_storage_bytes;
    IF v_limit IS NOT NULL AND v_current + p_delta > v_limit THEN
      RAISE EXCEPTION 'plan_limit_storage';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_plan_resource';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION check_groups_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_plan_limit(NEW.organization_id, 'groups', 1);
  RETURN NEW;
END;
$$;

CREATE TRIGGER groups_plan_limit
  BEFORE INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION check_groups_plan_limit();

CREATE OR REPLACE FUNCTION check_musicians_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_plan_limit(NEW.organization_id, 'musicians', 1);
  RETURN NEW;
END;
$$;

CREATE TRIGGER musicians_plan_limit
  BEFORE INSERT ON musicians
  FOR EACH ROW EXECUTE FUNCTION check_musicians_plan_limit();

CREATE OR REPLACE FUNCTION check_pieces_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_plan_limit(NEW.organization_id, 'pieces', 1);
  RETURN NEW;
END;
$$;

CREATE TRIGGER pieces_plan_limit
  BEFORE INSERT ON pieces
  FOR EACH ROW EXECUTE FUNCTION check_pieces_plan_limit();

CREATE OR REPLACE FUNCTION check_piece_files_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_org_plan_limit(NEW.organization_id, 'storage', COALESCE(NEW.byte_size, 0));
  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_files_plan_limit
  BEFORE INSERT ON piece_files
  FOR EACH ROW EXECUTE FUNCTION check_piece_files_plan_limit();

GRANT EXECUTE ON FUNCTION get_org_storage_bytes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_plan_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assert_org_plan_limit(UUID, TEXT, BIGINT) TO authenticated;
