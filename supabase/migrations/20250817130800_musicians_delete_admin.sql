-- Admins may delete musicians (assignments cascade via FK).

CREATE POLICY musicians_delete_admin ON musicians
  FOR DELETE TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));
