-- Teacher helpers also treat conductor (regente) as a group-scoped writer.
-- Function names stay is_teacher_* so existing RLS policies do not need to be recreated.

CREATE OR REPLACE FUNCTION is_teacher_in_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments a
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE a.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND a.ensemble_role IN ('teacher', 'conductor')
  );
$$;

CREATE OR REPLACE FUNCTION is_teacher_of_group(p_org_id UUID, p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments a
    INNER JOIN musicians m ON m.id = a.musician_id
    WHERE a.organization_id = p_org_id
      AND a.group_id = p_group_id
      AND m.user_id = auth.uid()
      AND a.ensemble_role IN ('teacher', 'conductor')
  );
$$;

CREATE OR REPLACE FUNCTION musician_in_teacher_groups(p_org_id UUID, p_musician_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments peer
    INNER JOIN assignments writer
      ON writer.group_id = peer.group_id
      AND writer.organization_id = peer.organization_id
      AND writer.ensemble_role IN ('teacher', 'conductor')
    INNER JOIN musicians me ON me.id = writer.musician_id
    WHERE peer.musician_id = p_musician_id
      AND peer.organization_id = p_org_id
      AND me.user_id = auth.uid()
  );
$$;
