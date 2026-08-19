-- Multi-use group invites with musician linkage.

ALTER TABLE group_invites
  ADD COLUMN IF NOT EXISTS max_uses INT NOT NULL DEFAULT 0;

ALTER TABLE group_invites
  DROP CONSTRAINT IF EXISTS group_invites_max_uses_check;

ALTER TABLE group_invites
  ADD CONSTRAINT group_invites_max_uses_check CHECK (max_uses >= 0);

ALTER TABLE musicians
  ADD COLUMN IF NOT EXISTS group_invite_id UUID REFERENCES group_invites (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS musicians_group_invite_id_idx ON musicians (group_invite_id);

-- Existing single-use redeemed invites become max_uses = 1.
UPDATE group_invites
SET max_uses = 1
WHERE redeemed_at IS NOT NULL;

UPDATE musicians m
SET group_invite_id = gi.id
FROM group_invites gi
WHERE gi.redeemed_by_user_id = m.user_id
  AND gi.organization_id = m.organization_id
  AND gi.redeemed_at IS NOT NULL;

DROP FUNCTION IF EXISTS create_group_invite(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION create_group_invite(
  p_group_id UUID,
  p_expires_at TIMESTAMPTZ,
  p_max_uses INT DEFAULT 0
)
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

  IF p_max_uses < 0 THEN
    RAISE EXCEPTION 'invalid_max_uses';
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
    max_uses,
    created_by_user_id
  )
  VALUES (
    v_group.organization_id,
    p_group_id,
    hash_token(v_token),
    v_token,
    p_expires_at,
    p_max_uses,
    v_user_id
  )
  RETURNING id INTO v_invite_id;

  RETURN QUERY SELECT v_invite_id, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_group_invite(UUID, TIMESTAMPTZ, INT) TO authenticated;

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
    AND gi.expires_at > now()
    AND g.archived_at IS NULL
    AND (
      gi.max_uses = 0
      OR (
        SELECT COUNT(*)::INT
        FROM musicians m
        WHERE m.group_invite_id = gi.id
      ) < gi.max_uses
    );
END;
$$;

CREATE OR REPLACE FUNCTION redeem_group_invite(
  p_token TEXT,
  p_phone TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL
)
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
  v_use_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM group_invites
  WHERE token_hash = v_hash
    AND revoked_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  SELECT COUNT(*)::INT INTO v_use_count
  FROM musicians
  WHERE group_invite_id = v_invite.id;

  IF v_invite.max_uses > 0 AND v_use_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'invite_exhausted';
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

  INSERT INTO musicians (
    organization_id,
    full_name,
    user_id,
    email,
    phone,
    birth_date,
    group_invite_id
  )
  VALUES (
    v_invite.organization_id,
    v_profile.display_name,
    v_user_id,
    v_profile.email,
    v_phone,
    p_birth_date,
    v_invite.id
  )
  RETURNING id INTO v_musician_id;

  INSERT INTO assignments (organization_id, musician_id, group_id, ensemble_role)
  VALUES (v_invite.organization_id, v_musician_id, v_invite.group_id, 'member');

  SELECT slug INTO v_org_slug FROM organizations WHERE id = v_invite.organization_id;

  RETURN QUERY SELECT v_org_slug;
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
    AND revoked_at IS NULL;
END;
$$;

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

  IF v_invite.revoked_at IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION update_group_invite_max_uses(p_invite_id UUID, p_max_uses INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invite group_invites%ROWTYPE;
  v_use_count INT;
BEGIN
  IF p_max_uses < 0 THEN
    RAISE EXCEPTION 'invalid_max_uses';
  END IF;

  SELECT * INTO v_invite FROM group_invites WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF NOT has_org_role(v_invite.organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_not_editable';
  END IF;

  SELECT COUNT(*)::INT INTO v_use_count
  FROM musicians
  WHERE group_invite_id = p_invite_id;

  IF p_max_uses > 0 AND p_max_uses < v_use_count THEN
    RAISE EXCEPTION 'max_uses_below_use_count';
  END IF;

  UPDATE group_invites
  SET max_uses = p_max_uses
  WHERE id = p_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_group_invite_max_uses(UUID, INT) TO authenticated;

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
  created_at TIMESTAMPTZ,
  max_uses INT,
  use_count INT,
  redeemed_musicians JSON
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
    gi.created_at,
    gi.max_uses,
    (
      SELECT COUNT(*)::INT
      FROM musicians m
      WHERE m.group_invite_id = gi.id
    ) AS use_count,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', m.id,
            'full_name', m.full_name,
            'email', m.email,
            'created_at', m.created_at
          )
          ORDER BY m.created_at ASC
        )
        FROM musicians m
        WHERE m.group_invite_id = gi.id
      ),
      '[]'::json
    ) AS redeemed_musicians
  FROM group_invites gi
  INNER JOIN groups g ON g.id = gi.group_id
  WHERE gi.organization_id = p_organization_id
  ORDER BY gi.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_group_invites(UUID) TO authenticated;
