-- Stop any authenticated user from reading another organization's plan usage.

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT is_org_member(p_org_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT is_org_member(p_org_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM groups WHERE organization_id = p_org_id AND archived_at IS NULL),
    (SELECT COUNT(*)::INT FROM musicians WHERE organization_id = p_org_id),
    (SELECT COUNT(*)::INT FROM pieces WHERE organization_id = p_org_id AND deleted_at IS NULL),
    (SELECT COUNT(*)::INT FROM events WHERE organization_id = p_org_id),
    get_org_storage_bytes(p_org_id);
END;
$$;
