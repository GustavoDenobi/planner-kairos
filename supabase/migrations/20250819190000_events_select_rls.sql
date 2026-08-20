-- INSERT ... RETURNING applies SELECT policies to the new row.
-- can_see_event(id) re-queries events and does not see the in-flight insert, so
-- PostgREST .insert().select() fails RLS for every user, including owner/admin.
-- Evaluate visibility from the row columns instead.

DROP POLICY IF EXISTS events_select_visible ON events;

CREATE POLICY events_select_visible ON events
  FOR SELECT TO authenticated
  USING (
    is_org_member(events.organization_id)
    AND (
      has_org_role(events.organization_id, ARRAY['owner', 'admin']::access_role[])
      OR events.created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM event_musicians em
        INNER JOIN musicians m ON m.id = em.musician_id
        WHERE em.event_id = events.id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM event_groups eg
        INNER JOIN assignments a ON a.group_id = eg.group_id
        INNER JOIN musicians m ON m.id = a.musician_id
        WHERE eg.event_id = events.id
          AND m.user_id = auth.uid()
      )
    )
  );
