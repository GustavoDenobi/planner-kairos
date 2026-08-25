-- Manual musician creation, claim-by-link, and merge for duplicate records.

CREATE OR REPLACE FUNCTION merge_musicians_internal(
  p_source_id UUID,
  p_target_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_source musicians%ROWTYPE;
  v_target musicians%ROWTYPE;
BEGIN
  SELECT * INTO v_source FROM musicians WHERE id = p_source_id;
  SELECT * INTO v_target FROM musicians WHERE id = p_target_id;

  IF v_source.id IS NULL OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_source.organization_id <> v_target.organization_id THEN
    RAISE EXCEPTION 'org_mismatch';
  END IF;

  IF v_source.id = v_target.id THEN
    RAISE EXCEPTION 'same_musician';
  END IF;

  IF v_source.user_id IS NOT NULL AND v_target.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'both_have_accounts';
  END IF;

  INSERT INTO assignments (
    organization_id,
    musician_id,
    group_id,
    section_id,
    part_id,
    ensemble_role
  )
  SELECT
    organization_id,
    p_target_id,
    group_id,
    section_id,
    part_id,
    ensemble_role
  FROM assignments
  WHERE musician_id = p_source_id
  ON CONFLICT DO NOTHING;

  INSERT INTO event_absences (organization_id, event_id, musician_id, marked_by, marked_at)
  SELECT organization_id, event_id, p_target_id, marked_by, marked_at
  FROM event_absences
  WHERE musician_id = p_source_id
  ON CONFLICT (event_id, musician_id) DO NOTHING;

  INSERT INTO event_musicians (organization_id, event_id, musician_id)
  SELECT organization_id, event_id, p_target_id
  FROM event_musicians
  WHERE musician_id = p_source_id
  ON CONFLICT (event_id, musician_id) DO NOTHING;

  INSERT INTO piece_musicians (organization_id, piece_id, musician_id)
  SELECT organization_id, piece_id, p_target_id
  FROM piece_musicians
  WHERE musician_id = p_source_id
  ON CONFLICT (piece_id, musician_id) DO NOTHING;

  UPDATE musicians AS target
  SET
    phone = COALESCE(target.phone, v_source.phone),
    email = COALESCE(target.email, v_source.email),
    birth_date = COALESCE(target.birth_date, v_source.birth_date),
    notes = CASE
      WHEN target.notes IS NULL OR btrim(target.notes) = '' THEN v_source.notes
      ELSE target.notes
    END,
    user_id = COALESCE(target.user_id, v_source.user_id)
  WHERE target.id = p_target_id;

  DELETE FROM musicians WHERE id = p_source_id;
END;
$$;

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

  RETURN QUERY SELECT v_musician_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_musician_claim_preview(p_musician_id UUID)
RETURNS TABLE (
  organization_name TEXT,
  organization_slug TEXT,
  organization_image_storage_key TEXT,
  musician_full_name TEXT,
  already_claimed BOOLEAN,
  assignments JSONB
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
  SELECT * INTO v_musician FROM musicians WHERE id = p_musician_id;

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
  WHERE a.musician_id = p_musician_id;

  RETURN QUERY
  SELECT
    v_org.name,
    v_org.slug,
    v_org.image_storage_key,
    v_musician.full_name,
    v_musician.user_id IS NOT NULL,
    v_assignments;
END;
$$;

CREATE OR REPLACE FUNCTION claim_musician(
  p_musician_id UUID,
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

  SELECT * INTO v_musician FROM musicians WHERE id = p_musician_id FOR UPDATE;

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
    AND id <> p_musician_id;

  IF v_existing_musician_id IS NOT NULL THEN
    PERFORM merge_musicians_internal(p_musician_id, v_existing_musician_id);

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
    WHERE id = p_musician_id;
  END IF;

  UPDATE profiles
  SET display_name = v_display_name
  WHERE id = v_user_id;

  SELECT slug INTO v_org_slug FROM organizations WHERE id = v_musician.organization_id;

  RETURN QUERY SELECT v_org_slug;
END;
$$;

CREATE OR REPLACE FUNCTION merge_musicians(
  p_source_id UUID,
  p_target_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_source musicians%ROWTYPE;
  v_target musicians%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_source FROM musicians WHERE id = p_source_id;
  SELECT * INTO v_target FROM musicians WHERE id = p_target_id;

  IF v_source.id IS NULL OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT has_org_role(v_source.organization_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM merge_musicians_internal(p_source_id, p_target_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_musician(UUID, TEXT, TEXT, TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_musician_claim_preview(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_musician(UUID, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION merge_musicians(UUID, UUID) TO authenticated;
