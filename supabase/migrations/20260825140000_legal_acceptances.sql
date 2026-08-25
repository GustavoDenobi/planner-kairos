-- Legal acceptances (platform and organization documents)

CREATE TABLE legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('platform', 'organization')),
  organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN ('terms_of_use', 'privacy_policy', 'organization_rules')
  ),
  document_version TEXT NOT NULL,
  context TEXT NOT NULL CHECK (
    context IN ('signup', 'invite', 'musician_claim', 'reacceptance')
  ),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_acceptances_org_scope_check CHECK (
    (scope = 'platform' AND organization_id IS NULL)
    OR (scope = 'organization' AND organization_id IS NOT NULL)
  ),
  CONSTRAINT legal_acceptances_unique_version UNIQUE (
    user_id,
    scope,
    organization_id,
    document_type,
    document_version
  )
);

CREATE INDEX legal_acceptances_user_scope_type_idx
  ON legal_acceptances (user_id, scope, document_type);

CREATE INDEX legal_acceptances_org_type_version_idx
  ON legal_acceptances (organization_id, document_type, document_version)
  WHERE organization_id IS NOT NULL;

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_acceptances_select_own ON legal_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY legal_acceptances_insert_own ON legal_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY legal_acceptances_select_org_admin ON legal_acceptances
  FOR SELECT TO authenticated
  USING (
    scope = 'organization'
    AND organization_id IS NOT NULL
    AND has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
  );

GRANT SELECT, INSERT ON legal_acceptances TO authenticated;
