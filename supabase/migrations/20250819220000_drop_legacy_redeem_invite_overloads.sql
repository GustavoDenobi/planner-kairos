-- Keep a single redeem_group_invite signature so PostgREST can resolve the RPC.
-- Legacy 1-arg and 2-arg versions still required redeemed_at IS NULL (single-use).

DROP FUNCTION IF EXISTS redeem_group_invite(TEXT);
DROP FUNCTION IF EXISTS redeem_group_invite(TEXT, TEXT);

GRANT EXECUTE ON FUNCTION redeem_group_invite(TEXT, TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_invite_preview(TEXT) TO anon, authenticated, service_role;
