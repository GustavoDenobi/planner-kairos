-- Integrantes não devem visualizar outros músicos cadastrados.
-- Admins/owners mantêm leitura completa; integrantes só leem o próprio registro.

DROP POLICY IF EXISTS musicians_select_member ON musicians;

CREATE POLICY musicians_select_admin ON musicians
  FOR SELECT TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY musicians_select_own ON musicians
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_org_member(organization_id));
