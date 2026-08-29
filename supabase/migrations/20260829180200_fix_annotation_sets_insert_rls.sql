-- Fix annotation_sets insert RLS and add explicit helper.

CREATE OR REPLACE FUNCTION can_create_annotation_set(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_member(p_org_id)
    AND (
      has_org_role(p_org_id, ARRAY['owner', 'admin']::access_role[])
      OR is_teacher_in_org(p_org_id)
    );
$$;

GRANT EXECUTE ON FUNCTION can_create_annotation_set(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS annotation_sets_insert ON annotation_sets;

CREATE POLICY annotation_sets_insert ON annotation_sets
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = (SELECT auth.uid())
    AND can_create_annotation_set(organization_id)
  );
