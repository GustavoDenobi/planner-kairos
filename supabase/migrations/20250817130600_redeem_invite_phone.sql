-- Store musician phone when redeeming a group invite.

CREATE OR REPLACE FUNCTION redeem_group_invite(p_token TEXT, p_phone TEXT DEFAULT NULL)
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
  v_phone TEXT;
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

  v_phone := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');

  INSERT INTO memberships (organization_id, user_id, access_role)
  VALUES (v_invite.organization_id, v_user_id, 'member');

  INSERT INTO musicians (organization_id, full_name, user_id, email, phone)
  VALUES (v_invite.organization_id, v_profile.display_name, v_user_id, v_profile.email, v_phone)
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
