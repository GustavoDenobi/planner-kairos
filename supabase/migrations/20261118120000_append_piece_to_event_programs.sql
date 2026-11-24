-- Adiciona uma obra (inteira ou com trechos) ao fim da programação de vários eventos de uma vez.
--
-- Diferente de reescrever a programação inteira (replaceProgram), aqui só se insere uma linha
-- nova por evento, numa única transação, sem tocar nos itens existentes. Duplicatas são
-- permitidas (a mesma obra pode ser tocada mais de uma vez); quem chama decide se avisa.
--
-- SECURITY INVOKER: as políticas de RLS e os triggers de program_items / program_item_units
-- continuam valendo. Eventos sem permissão de escrita, cancelados ou de outra organização são
-- pulados e reportados no resultado, em vez de abortar os demais.

CREATE OR REPLACE FUNCTION append_piece_to_event_programs(
  p_org_id UUID,
  p_piece_id UUID,
  p_event_ids UUID[],
  p_units JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_event RECORD;
  v_item_id UUID;
  v_next_sort INT;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_event_ids IS NULL OR cardinality(p_event_ids) = 0 THEN
    RETURN v_results;
  END IF;

  IF cardinality(p_event_ids) > 100 THEN
    RAISE EXCEPTION 'too_many_events';
  END IF;

  IF p_units IS NULL THEN
    p_units := '[]'::jsonb;
  END IF;

  FOR v_event_id IN SELECT DISTINCT unnest(p_event_ids) LOOP
    SELECT e.id, e.cancelled_at
    INTO v_event
    FROM events e
    WHERE e.id = v_event_id
      AND e.organization_id = p_org_id;

    IF NOT FOUND THEN
      v_results := v_results || jsonb_build_object('event_id', v_event_id, 'status', 'not_found');
      CONTINUE;
    END IF;

    IF v_event.cancelled_at IS NOT NULL THEN
      v_results := v_results || jsonb_build_object('event_id', v_event_id, 'status', 'cancelled');
      CONTINUE;
    END IF;

    IF NOT can_write_event(v_event_id) THEN
      v_results := v_results || jsonb_build_object('event_id', v_event_id, 'status', 'forbidden');
      CONTINUE;
    END IF;

    -- Serializa inserções concorrentes no mesmo evento para não repetir sort_order.
    PERFORM 1 FROM events WHERE id = v_event_id FOR UPDATE;

    SELECT COALESCE(MAX(sort_order) + 1, 0)
    INTO v_next_sort
    FROM program_items
    WHERE event_id = v_event_id;

    INSERT INTO program_items (organization_id, event_id, piece_id, sort_order, status)
    VALUES (p_org_id, v_event_id, p_piece_id, v_next_sort, 'planned')
    RETURNING id INTO v_item_id;

    INSERT INTO program_item_units (
      organization_id,
      program_item_id,
      piece_file_id,
      sort_order,
      start_page,
      end_page,
      navigation_shortcut_id,
      piece_file_toc_entry_id,
      label
    )
    SELECT
      p_org_id,
      v_item_id,
      (unit.value ->> 'piece_file_id')::uuid,
      COALESCE((unit.value ->> 'sort_order')::int, (unit.ordinality - 1)::int),
      (unit.value ->> 'start_page')::int,
      (unit.value ->> 'end_page')::int,
      (unit.value ->> 'navigation_shortcut_id')::uuid,
      (unit.value ->> 'piece_file_toc_entry_id')::uuid,
      NULLIF(btrim(unit.value ->> 'label'), '')
    FROM jsonb_array_elements(p_units) WITH ORDINALITY AS unit(value, ordinality);

    v_results := v_results || jsonb_build_object('event_id', v_event_id, 'status', 'added');
  END LOOP;

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION append_piece_to_event_programs(UUID, UUID, UUID[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION append_piece_to_event_programs(UUID, UUID, UUID[], JSONB) TO authenticated;
