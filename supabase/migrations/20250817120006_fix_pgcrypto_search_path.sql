-- pgcrypto (gen_random_bytes, digest) lives in the extensions schema on Supabase.
-- SECURITY DEFINER functions with search_path = public cannot resolve those symbols.

ALTER FUNCTION hash_token(TEXT) SET search_path = public, extensions;

ALTER FUNCTION get_invite_preview(TEXT) SET search_path = public, extensions;
ALTER FUNCTION redeem_group_invite(TEXT) SET search_path = public, extensions;
ALTER FUNCTION create_group_invite(UUID, TIMESTAMPTZ) SET search_path = public, extensions;
