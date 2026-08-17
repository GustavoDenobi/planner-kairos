-- Public branding images for link previews (WhatsApp, etc.) + invite preview metadata.

UPDATE storage.buckets SET public = true WHERE id = 'org-assets';

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
    AND gi.expires_at > now();
END;
$$;

GRANT EXECUTE ON FUNCTION get_invite_preview(TEXT) TO anon, authenticated;
