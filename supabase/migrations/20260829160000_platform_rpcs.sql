-- Platform admin RPCs

CREATE OR REPLACE FUNCTION platform_require_admin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION platform_list_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  plan_id UUID,
  plan_name TEXT,
  created_at TIMESTAMPTZ,
  memberships_count INT,
  groups_count INT,
  musicians_count INT,
  pieces_count INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.plan_id,
    p.name AS plan_name,
    o.created_at,
    (SELECT COUNT(*)::INT FROM memberships m WHERE m.organization_id = o.id),
    (SELECT COUNT(*)::INT FROM groups g WHERE g.organization_id = o.id AND g.archived_at IS NULL),
    (SELECT COUNT(*)::INT FROM musicians mu WHERE mu.organization_id = o.id),
    (SELECT COUNT(*)::INT FROM pi WHERE pi.organization_id = o.id AND pi.deleted_at IS NULL)
  FROM organizations o
  JOIN plans p ON p.id = o.plan_id
  LEFT JOIN pieces pi ON false
  ORDER BY o.name;
END;
$$;

-- Fix the broken query above - pieces subquery was wrong
DROP FUNCTION IF EXISTS platform_list_organizations();

CREATE OR REPLACE FUNCTION platform_list_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  plan_id UUID,
  plan_name TEXT,
  created_at TIMESTAMPTZ,
  memberships_count INT,
  groups_count INT,
  musicians_count INT,
  pieces_count INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.plan_id,
    p.name AS plan_name,
    o.created_at,
    (SELECT COUNT(*)::INT FROM memberships m WHERE m.organization_id = o.id),
    (SELECT COUNT(*)::INT FROM groups g WHERE g.organization_id = o.id AND g.archived_at IS NULL),
    (SELECT COUNT(*)::INT FROM musicians mu WHERE mu.organization_id = o.id),
    (SELECT COUNT(*)::INT FROM pieces pc WHERE pc.organization_id = o.id AND pc.deleted_at IS NULL)
  FROM organizations o
  JOIN plans p ON p.id = o.plan_id
  ORDER BY o.name;
END;
$$;

CREATE OR REPLACE FUNCTION platform_get_organization(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  plan_id UUID,
  plan_name TEXT,
  plan_slug TEXT,
  max_groups INT,
  max_musicians INT,
  max_pieces INT,
  max_storage_bytes BIGINT,
  created_at TIMESTAMPTZ,
  groups_count INT,
  musicians_count INT,
  pieces_count INT,
  events_count INT,
  memberships_count INT,
  storage_bytes BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.plan_id,
    p.name,
    p.slug,
    p.max_groups,
    p.max_musicians,
    p.max_pieces,
    p.max_storage_bytes,
    o.created_at,
    u.groups_count,
    u.musicians_count,
    u.pieces_count,
    u.events_count,
    (SELECT COUNT(*)::INT FROM memberships m WHERE m.organization_id = o.id),
    u.storage_bytes
  FROM organizations o
  JOIN plans p ON p.id = o.plan_id
  CROSS JOIN LATERAL get_org_plan_usage(o.id) u
  WHERE o.id = p_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION platform_create_organization(
  p_name TEXT,
  p_slug TEXT,
  p_owner_user_id UUID,
  p_plan_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_slug TEXT;
  v_name TEXT;
BEGIN
  PERFORM platform_require_admin();

  v_name := btrim(COALESCE(p_name, ''));
  v_slug := lower(btrim(COALESCE(p_slug, '')));

  IF v_name = '' OR v_slug = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'owner_not_found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM plans WHERE id = p_plan_id AND is_active = true) THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) THEN
    RAISE EXCEPTION 'slug_taken';
  END IF;

  INSERT INTO organizations (name, slug, plan_id)
  VALUES (v_name, v_slug, p_plan_id)
  RETURNING id INTO v_org_id;

  INSERT INTO memberships (organization_id, user_id, access_role)
  VALUES (v_org_id, p_owner_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET access_role = 'owner';

  PERFORM log_platform_audit(
    'create_organization',
    'organization',
    v_org_id,
    jsonb_build_object('name', v_name, 'slug', v_slug, 'owner_user_id', p_owner_user_id, 'plan_id', p_plan_id)
  );

  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION platform_assign_organization_plan(
  p_org_id UUID,
  p_plan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM plans WHERE id = p_plan_id) THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  UPDATE organizations
  SET plan_id = p_plan_id
  WHERE id = p_org_id;

  PERFORM log_platform_audit(
    'assign_organization_plan',
    'organization',
    p_org_id,
    jsonb_build_object('plan_id', p_plan_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION platform_list_users(
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  memberships_count INT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT;
  v_limit INT;
  v_offset INT;
BEGIN
  PERFORM platform_require_admin();

  v_search := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
  v_offset := GREATEST(0, COALESCE(p_offset, 0));

  RETURN QUERY
  WITH filtered AS (
    SELECT pr.*
    FROM profiles pr
    WHERE v_search IS NULL
      OR pr.display_name ILIKE '%' || v_search || '%'
      OR pr.email ILIKE '%' || v_search || '%'
  ),
  counted AS (
    SELECT COUNT(*)::BIGINT AS total FROM filtered
  )
  SELECT
    f.id,
    f.display_name,
    f.email,
    f.created_at,
    (SELECT COUNT(*)::INT FROM memberships m WHERE m.user_id = f.id),
    c.total
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.display_name
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION platform_get_user(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT,
  theme theme_preference,
  created_at TIMESTAMPTZ,
  memberships JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT
    pr.id,
    pr.display_name,
    pr.email,
    pr.theme,
    pr.created_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'membershipId', m.id,
            'organizationId', m.organization_id,
            'organizationName', o.name,
            'organizationSlug', o.slug,
            'accessRole', m.access_role
          )
          ORDER BY o.name
        )
        FROM memberships m
        JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = pr.id
      ),
      '[]'::JSONB
    )
  FROM profiles pr
  WHERE pr.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION platform_find_user_by_email(p_email TEXT)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  PERFORM platform_require_admin();

  v_email := lower(btrim(COALESCE(p_email, '')));
  IF v_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pr.id, pr.display_name, pr.email
  FROM profiles pr
  WHERE lower(pr.email) = v_email
  LIMIT 5;
END;
$$;

CREATE OR REPLACE FUNCTION platform_upsert_membership(
  p_org_id UUID,
  p_user_id UUID,
  p_role access_role
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_id UUID;
BEGIN
  PERFORM platform_require_admin();

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  INSERT INTO memberships (organization_id, user_id, access_role)
  VALUES (p_org_id, p_user_id, p_role)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET access_role = EXCLUDED.access_role
  RETURNING id INTO v_membership_id;

  PERFORM log_platform_audit(
    'upsert_membership',
    'membership',
    v_membership_id,
    jsonb_build_object('organization_id', p_org_id, 'user_id', p_user_id, 'access_role', p_role)
  );

  RETURN v_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION platform_remove_membership(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  DELETE FROM memberships
  WHERE organization_id = p_org_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership_not_found';
  END IF;

  PERFORM log_platform_audit(
    'remove_membership',
    'membership',
    NULL,
    jsonb_build_object('organization_id', p_org_id, 'user_id', p_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION platform_list_plans()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  max_groups INT,
  max_musicians INT,
  max_pieces INT,
  max_storage_bytes BIGINT,
  is_active BOOLEAN,
  sort_order INT,
  organizations_count INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.slug,
    p.description,
    p.max_groups,
    p.max_musicians,
    p.max_pieces,
    p.max_storage_bytes,
    p.is_active,
    p.sort_order,
    (SELECT COUNT(*)::INT FROM organizations o WHERE o.plan_id = p.id),
    p.created_at,
    p.updated_at
  FROM plans p
  ORDER BY p.sort_order, p.name;
END;
$$;

CREATE OR REPLACE FUNCTION platform_get_plan(p_plan_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  max_groups INT,
  max_musicians INT,
  max_pieces INT,
  max_storage_bytes BIGINT,
  is_active BOOLEAN,
  sort_order INT,
  organizations_count INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.slug,
    p.description,
    p.max_groups,
    p.max_musicians,
    p.max_pieces,
    p.max_storage_bytes,
    p.is_active,
    p.sort_order,
    (SELECT COUNT(*)::INT FROM organizations o WHERE o.plan_id = p.id),
    p.created_at,
    p.updated_at
  FROM plans p
  WHERE p.id = p_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION platform_upsert_plan(
  p_plan_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT,
  p_max_groups INT,
  p_max_musicians INT,
  p_max_pieces INT,
  p_max_storage_bytes BIGINT,
  p_is_active BOOLEAN,
  p_sort_order INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_name TEXT;
  v_slug TEXT;
BEGIN
  PERFORM platform_require_admin();

  v_name := btrim(COALESCE(p_name, ''));
  v_slug := lower(btrim(COALESCE(p_slug, '')));

  IF v_name = '' OR v_slug = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  IF p_plan_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM plans WHERE slug = v_slug) THEN
      RAISE EXCEPTION 'slug_taken';
    END IF;

    INSERT INTO plans (
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
      v_name,
      v_slug,
      NULLIF(btrim(COALESCE(p_description, '')), ''),
      p_max_groups,
      p_max_musicians,
      p_max_pieces,
      p_max_storage_bytes,
      COALESCE(p_is_active, true),
      COALESCE(p_sort_order, 0)
    )
    RETURNING id INTO v_plan_id;

    PERFORM log_platform_audit('create_plan', 'plan', v_plan_id, jsonb_build_object('slug', v_slug));
  ELSE
    IF EXISTS (
      SELECT 1 FROM plans
      WHERE slug = v_slug AND id <> p_plan_id
    ) THEN
      RAISE EXCEPTION 'slug_taken';
    END IF;

    UPDATE plans
    SET
      name = v_name,
      slug = v_slug,
      description = NULLIF(btrim(COALESCE(p_description, '')), ''),
      max_groups = p_max_groups,
      max_musicians = p_max_musicians,
      max_pieces = p_max_pieces,
      max_storage_bytes = p_max_storage_bytes,
      is_active = COALESCE(p_is_active, is_active),
      sort_order = COALESCE(p_sort_order, sort_order)
    WHERE id = p_plan_id
    RETURNING id INTO v_plan_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'plan_not_found';
    END IF;

    PERFORM log_platform_audit('update_plan', 'plan', v_plan_id, jsonb_build_object('slug', v_slug));
  END IF;

  RETURN v_plan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION platform_list_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION platform_get_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_create_organization(TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_assign_organization_plan(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_list_users(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_get_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_find_user_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_upsert_membership(UUID, UUID, access_role) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_remove_membership(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_list_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION platform_get_plan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_upsert_plan(UUID, TEXT, TEXT, TEXT, INT, INT, INT, BIGINT, BOOLEAN, INT) TO authenticated;
