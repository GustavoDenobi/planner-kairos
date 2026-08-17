-- RLS helpers and policies

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE musicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION has_org_role(p_org_id UUID, p_roles access_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.access_role = ANY (p_roles)
  );
$$;

-- organizations
CREATE POLICY organizations_select_member ON organizations
  FOR SELECT TO authenticated
  USING (is_org_member(id));

CREATE POLICY organizations_update_admin ON organizations
  FOR UPDATE TO authenticated
  USING (has_org_role(id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(id, ARRAY['owner', 'admin']::access_role[]));

-- profiles
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- memberships
CREATE POLICY memberships_select_member ON memberships
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY memberships_insert_admin ON memberships
  FOR INSERT TO authenticated
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY memberships_update_admin ON memberships
  FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY memberships_delete_admin ON memberships
  FOR DELETE TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

-- group_invites (no public read by token — use RPC)
CREATE POLICY group_invites_select_admin ON group_invites
  FOR SELECT TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY group_invites_insert_admin ON group_invites
  FOR INSERT TO authenticated
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY group_invites_update_admin ON group_invites
  FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

-- password_recovery_codes: no direct access for anon/authenticated

-- groups
CREATE POLICY groups_select_member ON groups
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY groups_write_admin ON groups
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

-- musicians
CREATE POLICY musicians_select_member ON musicians
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY musicians_write_admin ON musicians
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

-- assignments
CREATE POLICY assignments_select_member ON assignments
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY assignments_write_admin ON assignments
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));
