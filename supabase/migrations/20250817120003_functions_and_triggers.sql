-- Auth trigger, invite RPCs, token hashing

CREATE OR REPLACE FUNCTION hash_token(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(digest(p_token, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, email, theme)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'light'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION get_invite_preview(p_token TEXT)
RETURNS TABLE (
  invite_id UUID,
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  group_id UUID,
  group_name TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT := hash_token(p_token);
BEGIN
  RETURN QUERY
  SELECT
    gi.id,
    o.id,
    o.name,
    o.slug,
    g.id,
    g.name,
    gi.expires_at
  FROM group_invites gi
  INNER JOIN organizations o ON o.id = gi.organization_id
  INNER JOIN groups g ON g.id = gi.group_id
  WHERE gi.token_hash = v_hash
    AND gi.revoked_at IS NULL
    AND gi.redeemed_at IS NULL
    AND gi.expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION redeem_group_invite(p_token TEXT)
RETURNS TABLE (organization_slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hash TEXT := hash_token(p_token);
  v_invite group_invites%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_musician_id UUID;
  v_org_slug TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM group_invites
  WHERE token_hash = v_hash
    AND revoked_at IS NULL
    AND redeemed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = v_invite.organization_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM musicians
    WHERE organization_id = v_invite.organization_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'musician_exists';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;

  INSERT INTO memberships (organization_id, user_id, access_role)
  VALUES (v_invite.organization_id, v_user_id, 'member');

  INSERT INTO musicians (organization_id, full_name, user_id)
  VALUES (v_invite.organization_id, v_profile.display_name, v_user_id)
  RETURNING id INTO v_musician_id;

  INSERT INTO assignments (organization_id, musician_id, group_id, ensemble_role)
  VALUES (v_invite.organization_id, v_musician_id, v_invite.group_id, 'member');

  UPDATE group_invites
  SET redeemed_at = now(),
      redeemed_by_user_id = v_user_id
  WHERE id = v_invite.id;

  SELECT slug INTO v_org_slug FROM organizations WHERE id = v_invite.organization_id;

  RETURN QUERY SELECT v_org_slug;
END;
$$;

CREATE OR REPLACE FUNCTION create_group_invite(p_group_id UUID, p_expires_at TIMESTAMPTZ)
RETURNS TABLE (invite_id UUID, token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    expires_at,
    created_by_user_id
  )
  VALUES (
    v_group.organization_id,
    p_group_id,
    hash_token(v_token),
    p_expires_at,
    v_user_id
  )
  RETURNING id INTO v_invite_id;

  RETURN QUERY SELECT v_invite_id, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_group_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE group_invites
  SET revoked_at = now()
  WHERE id = p_invite_id
    AND revoked_at IS NULL
    AND redeemed_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION list_group_invites(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  group_name TEXT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION get_invite_preview(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_group_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_group_invite(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_group_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_group_invites(UUID) TO authenticated;
