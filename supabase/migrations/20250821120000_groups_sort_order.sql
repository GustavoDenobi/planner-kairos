-- Custom sort order for groups (e.g. repertoire group picker).

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY name) AS rn
  FROM groups
)
UPDATE groups AS g
SET sort_order = ranked.rn
FROM ranked
WHERE g.id = ranked.id;

CREATE INDEX IF NOT EXISTS groups_org_sort_order_idx
  ON groups (organization_id, sort_order);
