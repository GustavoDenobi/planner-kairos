-- Store invite token for admin copy; allow updating expiration on active invites.

ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS token TEXT;

CREATE OR REPLACE FUNCTION create_group_invite(p_group_id UUID, p_expires_at TIMESTAMPTZ)
RETURNS TABLE (invite_id UUID, token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_group groups%ROWTYPE;
  v_token TEXT;
  v_invite_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_group FROM groups WHERE id = p_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  IF NOT has_org_role(v_group.organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_token := replace(replace(replace(
    encode(gen_random_bytes(32), 'base64'),
    '+', '-'), '/', '_'), '=', '');

  INSERT INTO group_invites (
    organization_id,
    group_id,
    token_hash,
    token,
    expires_at,
    created_by_user_id
  )
  VALUES (
    v_group.organization_id,
    p_group_id,
    hash_token(v_token),
    v_token,
    p_expires_at,
    v_user_id
  )
  RETURNING id INTO v_invite_id;

  RETURN QUERY SELECT v_invite_id, v_token;
END;
$$;

DROP FUNCTION IF EXISTS list_group_invites(UUID);

CREATE FUNCTION list_group_invites(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  group_name TEXT,
  token TEXT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT has_org_role(p_organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    gi.id,
    gi.group_id,
    g.name,
    gi.token,
    gi.expires_at,
    gi.revoked_at,
    gi.redeemed_at,
    gi.created_at
  FROM group_invites gi
  INNER JOIN groups g ON g.id = gi.group_id
  WHERE gi.organization_id = p_organization_id
  ORDER BY gi.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_group_invites(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION update_group_invite_expires(p_invite_id UUID, p_expires_at TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invite group_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM group_invites WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF NOT has_org_role(v_invite.organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_invite.revoked_at IS NOT NULL OR v_invite.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_not_editable';
  END IF;

  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'invalid_expires_at';
  END IF;

  UPDATE group_invites
  SET expires_at = p_expires_at
  WHERE id = p_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_group_invite_expires(UUID, TIMESTAMPTZ) TO authenticated;
