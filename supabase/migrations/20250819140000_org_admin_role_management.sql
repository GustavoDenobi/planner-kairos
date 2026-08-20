-- Admin role management: owners and admins can grant/revoke admin on other members.
-- Owner role is not manageable through these RPCs.

CREATE OR REPLACE FUNCTION grant_org_admin(p_organization_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT has_org_role(p_organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_actor_id = p_user_id THEN
    RAISE EXCEPTION 'cannot_manage_self';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'membership_not_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND access_role = 'owner'
  ) THEN
    RAISE EXCEPTION 'target_is_owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'already_admin';
  END IF;

  UPDATE memberships
  SET access_role = 'admin'
  WHERE organization_id = p_organization_id
    AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_org_admin(p_organization_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT has_org_role(p_organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_actor_id = p_user_id THEN
    RAISE EXCEPTION 'cannot_manage_self';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  UPDATE memberships
  SET access_role = 'member'
  WHERE organization_id = p_organization_id
    AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION grant_org_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_org_admin(UUID, UUID) TO authenticated;
