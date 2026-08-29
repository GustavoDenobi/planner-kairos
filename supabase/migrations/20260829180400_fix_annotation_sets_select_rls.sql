-- INSERT ... RETURNING failed because annotation_sets_select called
-- can_see_annotation_set(), which re-reads annotation_sets under RLS.
-- Inline visibility rules so authors/admins can read rows immediately after insert.

DROP FUNCTION IF EXISTS debug_auth_uid();

DROP POLICY IF EXISTS annotation_sets_select ON annotation_sets;

CREATE POLICY annotation_sets_select ON annotation_sets
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id)
    AND (
      has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[])
      OR author_user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM annotation_set_musicians asm
        INNER JOIN musicians m ON m.id = asm.musician_id
        WHERE asm.annotation_set_id = annotation_sets.id
          AND m.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM annotation_set_groups asg
        INNER JOIN assignments a ON a.group_id = asg.group_id
        INNER JOIN musicians m ON m.id = a.musician_id
        WHERE asg.annotation_set_id = annotation_sets.id
          AND m.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE OR REPLACE FUNCTION can_see_annotation_set(p_set_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM annotation_sets s
    WHERE s.id = p_set_id
      AND is_org_member(s.organization_id)
      AND (
        has_org_role(s.organization_id, ARRAY['owner', 'admin']::access_role[])
        OR s.author_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM annotation_set_musicians asm
          INNER JOIN musicians m ON m.id = asm.musician_id
          WHERE asm.annotation_set_id = s.id
            AND m.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM annotation_set_groups asg
          INNER JOIN assignments a ON a.group_id = asg.group_id
          INNER JOIN musicians m ON m.id = a.musician_id
          WHERE asg.annotation_set_id = s.id
            AND m.user_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION can_see_annotation_set(UUID) TO authenticated, service_role;
