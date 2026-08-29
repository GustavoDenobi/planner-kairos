-- INSERT ... RETURNING applies SELECT policies to the new row.
-- can_see_recurrence(id) re-queries event_recurrences and does not see the in-flight insert, so
-- PostgREST .insert().select() fails RLS for every user, including owner/admin.
-- Evaluate visibility from the row columns instead.

DROP POLICY IF EXISTS event_recurrences_select_visible ON event_recurrences;

CREATE POLICY event_recurrences_select_visible ON event_recurrences
  FOR SELECT TO authenticated
  USING (
    is_org_member(event_recurrences.organization_id)
    AND (
      has_org_role(event_recurrences.organization_id, ARRAY['owner', 'admin']::access_role[])
      OR event_recurrences.created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM event_recurrence_musicians rm
        INNER JOIN musicians m ON m.id = rm.musician_id
        WHERE rm.recurrence_id = event_recurrences.id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM event_recurrence_groups rg
        INNER JOIN assignments a ON a.group_id = rg.group_id
        INNER JOIN musicians m ON m.id = a.musician_id
        WHERE rg.recurrence_id = event_recurrences.id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM events e
        WHERE e.recurrence_id = event_recurrences.id
          AND can_see_event(e.id)
      )
    )
  );
