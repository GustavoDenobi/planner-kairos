-- Relatórios do repertório: filtros de grupo, tipo de evento e categoria com seleção múltipla.
--
-- Substitui a versão de 20261117120000 (um grupo e um tipo por vez, sem categoria). Cada filtro
-- recebe uma lista (qualquer valor casa; NULL ou lista vazia = sem filtro). Obras excluídas
-- ficam de fora inclusive das contagens mensais.

DROP FUNCTION IF EXISTS get_repertoire_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION get_repertoire_report(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_group_ids UUID[] DEFAULT NULL,
  p_event_type_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_time_zone TEXT DEFAULT 'America/Sao_Paulo'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT has_org_role(p_org_id, ARRAY['owner', 'admin']::access_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'invalid_range';
  END IF;

  IF p_to - p_from > INTERVAL '10 years' THEN
    RAISE EXCEPTION 'range_too_long';
  END IF;

  IF cardinality(p_group_ids) = 0 THEN
    p_group_ids := NULL;
  END IF;

  IF cardinality(p_event_type_ids) = 0 THEN
    p_event_type_ids := NULL;
  END IF;

  IF cardinality(p_category_ids) = 0 THEN
    p_category_ids := NULL;
  END IF;

  WITH scoped_items AS (
    SELECT pi.piece_id, pi.event_id, pi.status, e.starts_at
    FROM events e
    INNER JOIN program_items pi ON pi.event_id = e.id
    INNER JOIN pieces ip ON ip.id = pi.piece_id
    WHERE e.organization_id = p_org_id
      AND ip.deleted_at IS NULL
      AND (p_category_ids IS NULL OR ip.category_id = ANY (p_category_ids))
      AND e.cancelled_at IS NULL
      AND (p_event_type_ids IS NULL OR e.type_id = ANY (p_event_type_ids))
      AND (
        p_group_ids IS NULL
        OR EXISTS (
          SELECT 1
          FROM event_groups eg
          WHERE eg.event_id = e.id
            AND eg.group_id = ANY (p_group_ids)
        )
      )
  ),
  period_items AS (
    SELECT *
    FROM scoped_items
    WHERE starts_at >= p_from
      AND starts_at < p_to
  ),
  piece_stats AS (
    SELECT
      piece_id,
      COUNT(*) FILTER (
        WHERE status = 'performed' AND starts_at >= p_from AND starts_at < p_to
      ) AS performances,
      COUNT(*) FILTER (
        WHERE status = 'skipped' AND starts_at >= p_from AND starts_at < p_to
      ) AS skipped,
      COUNT(*) FILTER (
        WHERE status = 'planned' AND starts_at >= p_from AND starts_at < LEAST(p_to, now())
      ) AS unmarked,
      MAX(starts_at) FILTER (WHERE status = 'performed') AS last_performed_at
    FROM scoped_items
    GROUP BY piece_id
  ),
  scoped_pieces AS (
    SELECT p.id, p.title, p.category_id
    FROM pieces p
    WHERE p.organization_id = p_org_id
      AND p.deleted_at IS NULL
      AND (p_category_ids IS NULL OR p.category_id = ANY (p_category_ids))
      AND (
        p_group_ids IS NULL
        OR EXISTS (
          SELECT 1
          FROM piece_groups pg
          WHERE pg.piece_id = p.id
            AND pg.group_id = ANY (p_group_ids)
        )
        OR EXISTS (SELECT 1 FROM piece_stats s WHERE s.piece_id = p.id)
      )
  ),
  month_series AS (
    SELECT generate_series(
      date_trunc('month', p_from AT TIME ZONE p_time_zone),
      date_trunc('month', (p_to - INTERVAL '1 microsecond') AT TIME ZONE p_time_zone),
      INTERVAL '1 month'
    ) AS month_start
  ),
  month_counts AS (
    SELECT
      date_trunc('month', starts_at AT TIME ZONE p_time_zone) AS month_start,
      COUNT(*) AS performances
    FROM period_items
    WHERE status = 'performed'
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'pieces',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'piece_id', sp.id,
            'title', sp.title,
            'category_id', sp.category_id,
            'performances', COALESCE(s.performances, 0),
            'skipped', COALESCE(s.skipped, 0),
            'unmarked', COALESCE(s.unmarked, 0),
            'last_performed_at', s.last_performed_at
          )
          ORDER BY sp.title
        )
        FROM scoped_pieces sp
        LEFT JOIN piece_stats s ON s.piece_id = sp.id
      ),
      '[]'::JSONB
    ),
    'months',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'month', to_char(ms.month_start, 'YYYY-MM'),
            'performances', COALESCE(mc.performances, 0)
          )
          ORDER BY ms.month_start
        )
        FROM month_series ms
        LEFT JOIN month_counts mc ON mc.month_start = ms.month_start
      ),
      '[]'::JSONB
    ),
    'events',
    (
      SELECT COUNT(DISTINCT event_id)
      FROM period_items
      WHERE status = 'performed'
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_repertoire_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], UUID[], UUID[], TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_repertoire_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], UUID[], UUID[], TEXT)
  TO authenticated;
