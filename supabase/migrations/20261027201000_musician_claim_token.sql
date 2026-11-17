-- Claim links use a secret token, like group invites.
-- The plaintext token is NOT stored on musicians: teachers and event
-- participants can SELECT those rows, which would leak the link.
-- Only the hash lives on musicians. The token itself is in a table
-- with no client policies and is returned only by an admin RPC.

ALTER TABLE musicians
  ADD COLUMN claim_token_hash TEXT;

CREATE UNIQUE INDEX musicians_claim_token_hash_idx
  ON musicians (claim_token_hash)
  WHERE claim_token_hash IS NOT NULL;

CREATE TABLE musician_claim_tokens (
  musician_id UUID PRIMARY KEY REFERENCES musicians (id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE musician_claim_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE musician_claim_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE musician_claim_tokens TO service_role;

CREATE OR REPLACE FUNCTION issue_musician_claim_token(p_musician_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_existing TEXT;
BEGIN
  SELECT token INTO v_existing
  FROM musician_claim_tokens
  WHERE musician_id = p_musician_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_token := replace(replace(replace(
    encode(gen_random_bytes(32), 'base64'),
    '+', '-'), '/', '_'), '=', '');

  UPDATE musicians
  SET claim_token_hash = hash_token(v_token)
  WHERE id = p_musician_id;

  INSERT INTO musician_claim_tokens (musician_id, token)
  VALUES (p_musician_id, v_token);

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION issue_musician_claim_token(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION issue_musician_claim_token(UUID) TO service_role;

CREATE OR REPLACE FUNCTION ensure_musician_claim_token(p_musician_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_musician musicians%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_musician FROM musicians WHERE id = p_musician_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_musician.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  IF NOT has_org_role(v_musician.organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN issue_musician_claim_token(p_musician_id);
END;
$$;

REVOKE ALL ON FUNCTION ensure_musician_claim_token(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ensure_musician_claim_token(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION create_musician(
  p_organization_id UUID,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (musician_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_musician_id UUID;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT has_org_role(p_organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF btrim(COALESCE(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  v_phone := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  v_email := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');

  INSERT INTO musicians (
    organization_id,
    full_name,
    phone,
    email,
    birth_date,
    notes,
    user_id
  )
  VALUES (
    p_organization_id,
    btrim(p_full_name),
    v_phone,
    v_email,
    p_birth_date,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    NULL
  )
  RETURNING id INTO v_musician_id;

  PERFORM issue_musician_claim_token(v_musician_id);

  RETURN QUERY SELECT v_musician_id;
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM musicians
    WHERE user_id IS NULL
      AND claim_token_hash IS NULL
  LOOP
    PERFORM issue_musician_claim_token(r.id);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS get_musician_claim_preview(UUID);

CREATE OR REPLACE FUNCTION get_musician_claim_preview(p_token TEXT)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  organization_image_storage_key TEXT,
  musician_full_name TEXT,
  already_claimed BOOLEAN,
  assignments JSONB,
  rules_title TEXT,
  rules_markdown TEXT,
  rules_version INTEGER,
  requires_rules_acceptance BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_musician musicians%ROWTYPE;
  v_org organizations%ROWTYPE;
  v_assignments JSONB;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN;
  END IF;

  SELECT * INTO v_musician
  FROM musicians
  WHERE claim_token_hash = hash_token(p_token);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = v_musician.organization_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'group_name', g.name,
        'section_name', s.name,
        'part_name', p.name,
        'ensemble_role', a.ensemble_role::TEXT
      )
      ORDER BY g.name, s.name NULLS LAST, p.name NULLS LAST
    ),
    '[]'::JSONB
  )
  INTO v_assignments
  FROM assignments a
  INNER JOIN groups g ON g.id = a.group_id
  LEFT JOIN sections s ON s.id = a.section_id
  LEFT JOIN parts p ON p.id = a.part_id
  WHERE a.musician_id = v_musician.id;

  RETURN QUERY
  SELECT
    v_org.id,
    v_org.name,
    v_org.slug,
    v_org.image_storage_key,
    v_musician.full_name,
    v_musician.user_id IS NOT NULL,
    v_assignments,
    v_org.rules_title,
    v_org.rules_markdown,
    v_org.rules_version,
    v_org.requires_rules_acceptance;
END;
$$;

REVOKE ALL ON FUNCTION get_musician_claim_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_musician_claim_preview(TEXT) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS claim_musician(UUID, TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION claim_musician(
  p_token TEXT,
  p_display_name TEXT,
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
  v_musician musicians%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_existing_musician_id UUID;
  v_org_slug TEXT;
  v_phone TEXT;
  v_display_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  SELECT * INTO v_musician
  FROM musicians
  WHERE claim_token_hash = hash_token(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_musician.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  v_display_name := btrim(COALESCE(p_display_name, ''));
  IF v_display_name = '' THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  v_phone := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = v_musician.organization_id
      AND user_id = v_user_id
  ) THEN
    INSERT INTO memberships (organization_id, user_id, access_role)
    VALUES (v_musician.organization_id, v_user_id, 'member');
  END IF;

  SELECT id INTO v_existing_musician_id
  FROM musicians
  WHERE organization_id = v_musician.organization_id
    AND user_id = v_user_id
    AND id <> v_musician.id;

  IF v_existing_musician_id IS NOT NULL THEN
    PERFORM merge_musicians_internal(v_musician.id, v_existing_musician_id);

    UPDATE musicians
    SET
      full_name = v_display_name,
      phone = COALESCE(v_phone, phone),
      birth_date = COALESCE(p_birth_date, birth_date),
      email = COALESCE(email, v_profile.email)
    WHERE id = v_existing_musician_id;
  ELSE
    UPDATE musicians
    SET
      user_id = v_user_id,
      full_name = v_display_name,
      email = v_profile.email,
      phone = v_phone,
      birth_date = p_birth_date
    WHERE id = v_musician.id;
  END IF;

  UPDATE profiles
  SET display_name = v_display_name
  WHERE id = v_user_id;

  SELECT slug INTO v_org_slug FROM organizations WHERE id = v_musician.organization_id;

  RETURN QUERY SELECT v_org_slug;
END;
$$;

REVOKE ALL ON FUNCTION claim_musician(TEXT, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_musician(TEXT, TEXT, TEXT, DATE) TO authenticated, service_role;
