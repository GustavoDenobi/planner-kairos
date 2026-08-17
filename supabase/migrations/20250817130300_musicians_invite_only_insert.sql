-- Musicians are created only via invite acceptance (SECURITY DEFINER RPC).
-- Admins may still update profile fields on existing musicians.

DROP POLICY IF EXISTS musicians_write_admin ON musicians;

CREATE POLICY musicians_update_admin ON musicians
  FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));
