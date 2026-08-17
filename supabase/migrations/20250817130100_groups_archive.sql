-- Soft-archive groups: hidden from default listing, unavailable for new musicians.

ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS groups_org_active_idx ON groups (organization_id) WHERE archived_at IS NULL;

-- Block invites for archived groups
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

  IF v_group.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_archived';
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

-- Hide invites for archived groups from public preview
CREATE OR REPLACE FUNCTION get_invite_preview(p_token TEXT)
RETURNS TABLE (
  invite_id UUID,
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  organization_image_storage_key TEXT,
  group_id UUID,
  group_name TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
    o.image_storage_key,
    g.id,
    g.name,
    gi.expires_at
  FROM group_invites gi
  INNER JOIN organizations o ON o.id = gi.organization_id
  INNER JOIN groups g ON g.id = gi.group_id
  WHERE gi.token_hash = v_hash
    AND gi.revoked_at IS NULL
    AND gi.redeemed_at IS NULL
    AND gi.expires_at > now()
    AND g.archived_at IS NULL;
END;
$$;

-- Block redemption when group is archived
CREATE OR REPLACE FUNCTION redeem_group_invite(p_token TEXT)
RETURNS TABLE (organization_slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hash TEXT := hash_token(p_token);
  v_invite group_invites%ROWTYPE;
  v_group groups%ROWTYPE;
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

  SELECT * INTO v_group FROM groups WHERE id = v_invite.group_id;

  IF v_group.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_archived';
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
