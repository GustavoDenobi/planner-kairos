-- Platform administration: staff table, audit log, RLS bypass for platform admins

CREATE TABLE platform_admins (
  user_id UUID PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles (id) ON DELETE SET NULL
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admins_select_own ON platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_admins pa
    WHERE pa.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_platform_admin()
    OR EXISTS (
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
  SELECT is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM memberships m
      WHERE m.organization_id = p_org_id
        AND m.user_id = auth.uid()
        AND m.access_role = ANY (p_roles)
    );
$$;

CREATE POLICY organizations_select_platform_admin ON organizations
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE OR REPLACE FUNCTION log_platform_audit(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, COALESCE(p_metadata, '{}'::JSONB));
END;
$$;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION log_platform_audit(TEXT, TEXT, UUID, JSONB) TO authenticated;
