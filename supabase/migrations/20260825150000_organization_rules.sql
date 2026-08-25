-- Organization rules (markdown) and acceptance settings

ALTER TABLE organizations
  ADD COLUMN rules_title TEXT,
  ADD COLUMN rules_markdown TEXT,
  ADD COLUMN rules_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN requires_rules_acceptance BOOLEAN NOT NULL DEFAULT false;

-- Extend invite preview with organization rules
DROP FUNCTION IF EXISTS get_invite_preview(TEXT);

CREATE OR REPLACE FUNCTION get_invite_preview(p_token TEXT)
RETURNS TABLE (
  invite_id UUID,
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  organization_image_storage_key TEXT,
  group_id UUID,
  group_name TEXT,
  expires_at TIMESTAMPTZ,
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
    gi.expires_at,
    o.rules_title,
    o.rules_markdown,
    o.rules_version,
    o.requires_rules_acceptance
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

-- Extend musician claim preview with organization rules
DROP FUNCTION IF EXISTS get_musician_claim_preview(UUID);

CREATE OR REPLACE FUNCTION get_musician_claim_preview(p_musician_id UUID)
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

GRANT EXECUTE ON FUNCTION get_invite_preview(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_musician_claim_preview(UUID) TO anon, authenticated, service_role;
