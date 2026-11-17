-- Cobrança manual (Pix direto, sem gateway).
--
-- O admin da plataforma configura valor/ciclo/vencimento por organização, registra os pagamentos
-- recebidos e troca o plano manualmente. O sistema só calcula a situação (em dia, carência,
-- atraso) no app; nada é rebaixado automaticamente.
--
-- As tabelas têm RLS ligado e nenhuma policy: todo acesso passa pelas RPCs abaixo.

CREATE TABLE org_billing (
  organization_id UUID PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  cycle_months INT NOT NULL DEFAULT 1 CHECK (cycle_months IN (1, 3, 6, 12)),
  next_due_date DATE NOT NULL,
  grace_days INT NOT NULL DEFAULT 7 CHECK (grace_days BETWEEN 0 AND 90),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER org_billing_updated_at
  BEFORE UPDATE ON org_billing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE org_billing ENABLE ROW LEVEL SECURITY;

CREATE TABLE org_billing_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('payment', 'plan_change', 'note')),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_cents INT CHECK (amount_cents IS NULL OR amount_cents >= 0),
  from_plan_id UUID REFERENCES plans (id) ON DELETE SET NULL,
  to_plan_id UUID REFERENCES plans (id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (kind <> 'payment' OR amount_cents IS NOT NULL)
);

CREATE INDEX org_billing_entries_org_idx
  ON org_billing_entries (organization_id, occurred_on DESC, created_at DESC);

ALTER TABLE org_billing_entries ENABLE ROW LEVEL SECURITY;

-- Linha única com os dados de recebimento exibidos às organizações.
CREATE TABLE platform_billing_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  pix_key TEXT,
  pix_recipient_name TEXT,
  instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER platform_billing_settings_updated_at
  BEFORE UPDATE ON platform_billing_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE platform_billing_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO platform_billing_settings (id) VALUES (true);

-- ---------------------------------------------------------------------------
-- Admin da plataforma: configuração da cobrança da organização
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION platform_get_org_billing(p_org_id UUID)
RETURNS TABLE (
  organization_id UUID,
  is_active BOOLEAN,
  amount_cents INT,
  cycle_months INT,
  next_due_date DATE,
  grace_days INT,
  notes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT b.organization_id, b.is_active, b.amount_cents, b.cycle_months, b.next_due_date,
         b.grace_days, b.notes
  FROM org_billing b
  WHERE b.organization_id = p_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION platform_upsert_org_billing(
  p_org_id UUID,
  p_is_active BOOLEAN,
  p_amount_cents INT,
  p_cycle_months INT,
  p_next_due_date DATE,
  p_grace_days INT,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents < 0
     OR p_cycle_months IS NULL OR p_cycle_months NOT IN (1, 3, 6, 12)
     OR p_next_due_date IS NULL
     OR p_grace_days IS NULL OR p_grace_days < 0 OR p_grace_days > 90 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  INSERT INTO org_billing (
    organization_id, is_active, amount_cents, cycle_months, next_due_date, grace_days, notes
  )
  VALUES (
    p_org_id, COALESCE(p_is_active, true), p_amount_cents, p_cycle_months, p_next_due_date,
    p_grace_days, NULLIF(btrim(p_notes), '')
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    amount_cents = EXCLUDED.amount_cents,
    cycle_months = EXCLUDED.cycle_months,
    next_due_date = EXCLUDED.next_due_date,
    grace_days = EXCLUDED.grace_days,
    notes = EXCLUDED.notes;

  PERFORM log_platform_audit(
    'upsert_org_billing',
    'organization',
    p_org_id,
    jsonb_build_object(
      'is_active', p_is_active,
      'amount_cents', p_amount_cents,
      'cycle_months', p_cycle_months,
      'next_due_date', p_next_due_date,
      'grace_days', p_grace_days
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin da plataforma: histórico (pagamentos, trocas de plano, anotações)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION platform_list_org_billing_entries(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  kind TEXT,
  occurred_on DATE,
  amount_cents INT,
  from_plan_name TEXT,
  to_plan_name TEXT,
  note TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT
    e.id,
    e.kind,
    e.occurred_on,
    e.amount_cents,
    fp.name,
    tp.name,
    e.note,
    pr.display_name,
    e.created_at
  FROM org_billing_entries e
  LEFT JOIN plans fp ON fp.id = e.from_plan_id
  LEFT JOIN plans tp ON tp.id = e.to_plan_id
  LEFT JOIN profiles pr ON pr.id = e.created_by
  WHERE e.organization_id = p_org_id
  ORDER BY e.occurred_on DESC, e.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION platform_record_org_payment(
  p_org_id UUID,
  p_paid_on DATE,
  p_amount_cents INT,
  p_next_due_date DATE,
  p_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  PERFORM platform_require_admin();

  IF NOT EXISTS (SELECT 1 FROM org_billing WHERE organization_id = p_org_id) THEN
    RAISE EXCEPTION 'billing_not_configured';
  END IF;

  IF p_paid_on IS NULL OR p_amount_cents IS NULL OR p_amount_cents < 0
     OR p_next_due_date IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  INSERT INTO org_billing_entries (organization_id, kind, occurred_on, amount_cents, note, created_by)
  VALUES (p_org_id, 'payment', p_paid_on, p_amount_cents, NULLIF(btrim(p_note), ''), auth.uid())
  RETURNING id INTO v_entry_id;

  UPDATE org_billing
  SET next_due_date = p_next_due_date
  WHERE organization_id = p_org_id;

  PERFORM log_platform_audit(
    'record_org_payment',
    'organization',
    p_org_id,
    jsonb_build_object(
      'entry_id', v_entry_id,
      'paid_on', p_paid_on,
      'amount_cents', p_amount_cents,
      'next_due_date', p_next_due_date
    )
  );

  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION platform_add_org_billing_note(p_org_id UUID, p_note TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  PERFORM platform_require_admin();

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  INSERT INTO org_billing_entries (organization_id, kind, note, created_by)
  VALUES (p_org_id, 'note', btrim(p_note), auth.uid())
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

-- Remove um lançamento feito por engano. Não mexe no vencimento: ajuste-o na configuração.
CREATE OR REPLACE FUNCTION platform_delete_org_billing_entry(p_entry_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry org_billing_entries%ROWTYPE;
BEGIN
  PERFORM platform_require_admin();

  DELETE FROM org_billing_entries
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  PERFORM log_platform_audit(
    'delete_org_billing_entry',
    'organization',
    v_entry.organization_id,
    to_jsonb(v_entry)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Troca de plano: passa a registrar no histórico, com motivo, e pode encerrar a cobrança.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS platform_assign_organization_plan(UUID, UUID);

CREATE OR REPLACE FUNCTION platform_assign_organization_plan(
  p_org_id UUID,
  p_plan_id UUID,
  p_note TEXT DEFAULT NULL,
  p_stop_billing BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_plan_id UUID;
BEGIN
  PERFORM platform_require_admin();

  SELECT plan_id INTO v_previous_plan_id FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM plans WHERE id = p_plan_id) THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF v_previous_plan_id IS DISTINCT FROM p_plan_id THEN
    UPDATE organizations
    SET plan_id = p_plan_id
    WHERE id = p_org_id;

    INSERT INTO org_billing_entries (
      organization_id, kind, from_plan_id, to_plan_id, note, created_by
    )
    VALUES (
      p_org_id, 'plan_change', v_previous_plan_id, p_plan_id, NULLIF(btrim(p_note), ''), auth.uid()
    );
  END IF;

  IF p_stop_billing THEN
    UPDATE org_billing
    SET is_active = false
    WHERE organization_id = p_org_id;
  END IF;

  PERFORM log_platform_audit(
    'assign_organization_plan',
    'organization',
    p_org_id,
    jsonb_build_object(
      'plan_id', p_plan_id,
      'previous_plan_id', v_previous_plan_id,
      'stop_billing', p_stop_billing
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Lista de organizações com a cobrança (para o painel e o badge de situação)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS platform_list_organizations();

CREATE OR REPLACE FUNCTION platform_list_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  plan_id UUID,
  plan_name TEXT,
  created_at TIMESTAMPTZ,
  memberships_count INT,
  groups_count INT,
  musicians_count INT,
  pieces_count INT,
  billing_is_active BOOLEAN,
  billing_amount_cents INT,
  billing_cycle_months INT,
  billing_next_due_date DATE,
  billing_grace_days INT,
  billing_last_payment_on DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.plan_id,
    p.name AS plan_name,
    o.created_at,
    (SELECT COUNT(*)::INT FROM memberships m WHERE m.organization_id = o.id),
    (SELECT COUNT(*)::INT FROM groups g WHERE g.organization_id = o.id AND g.archived_at IS NULL),
    (SELECT COUNT(*)::INT FROM musicians mu WHERE mu.organization_id = o.id),
    (SELECT COUNT(*)::INT FROM pieces pc WHERE pc.organization_id = o.id AND pc.deleted_at IS NULL),
    b.is_active,
    b.amount_cents,
    b.cycle_months,
    b.next_due_date,
    b.grace_days,
    (
      SELECT MAX(e.occurred_on)
      FROM org_billing_entries e
      WHERE e.organization_id = o.id AND e.kind = 'payment'
    )
  FROM organizations o
  JOIN plans p ON p.id = o.plan_id
  LEFT JOIN org_billing b ON b.organization_id = o.id
  ORDER BY o.name;
END;
$$;

-- ---------------------------------------------------------------------------
-- Dados de recebimento (Pix)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION platform_get_billing_settings()
RETURNS TABLE (pix_key TEXT, pix_recipient_name TEXT, instructions TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  RETURN QUERY
  SELECT s.pix_key, s.pix_recipient_name, s.instructions
  FROM platform_billing_settings s;
END;
$$;

CREATE OR REPLACE FUNCTION platform_update_billing_settings(
  p_pix_key TEXT,
  p_pix_recipient_name TEXT,
  p_instructions TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM platform_require_admin();

  UPDATE platform_billing_settings
  SET pix_key = NULLIF(btrim(p_pix_key), ''),
      pix_recipient_name = NULLIF(btrim(p_pix_recipient_name), ''),
      instructions = NULLIF(btrim(p_instructions), '');

  PERFORM log_platform_audit('update_billing_settings', 'platform', NULL, '{}'::JSONB);
END;
$$;

-- ---------------------------------------------------------------------------
-- Visão da organização (owner/admin): situação, Pix e últimos pagamentos.
-- Sem linhas quando a organização não tem cobrança ativa.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_org_billing_overview(p_org_id UUID)
RETURNS TABLE (
  amount_cents INT,
  cycle_months INT,
  next_due_date DATE,
  grace_days INT,
  pix_key TEXT,
  pix_recipient_name TEXT,
  instructions TEXT,
  recent_payments JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT has_org_role(p_org_id, ARRAY['owner', 'admin']::access_role[])
     AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    b.amount_cents,
    b.cycle_months,
    b.next_due_date,
    b.grace_days,
    s.pix_key,
    s.pix_recipient_name,
    s.instructions,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('paidOn', r.occurred_on, 'amountCents', r.amount_cents)
          ORDER BY r.occurred_on DESC, r.created_at DESC
        )
        FROM (
          SELECT e.occurred_on, e.amount_cents, e.created_at
          FROM org_billing_entries e
          WHERE e.organization_id = p_org_id AND e.kind = 'payment'
          ORDER BY e.occurred_on DESC, e.created_at DESC
          LIMIT 6
        ) r
      ),
      '[]'::JSONB
    )
  FROM org_billing b
  CROSS JOIN platform_billing_settings s
  WHERE b.organization_id = p_org_id
    AND b.is_active;
END;
$$;

GRANT EXECUTE ON FUNCTION platform_get_org_billing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_upsert_org_billing(UUID, BOOLEAN, INT, INT, DATE, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_list_org_billing_entries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_record_org_payment(UUID, DATE, INT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_add_org_billing_note(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_delete_org_billing_entry(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_assign_organization_plan(UUID, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_list_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION platform_get_billing_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION platform_update_billing_settings(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_billing_overview(UUID) TO authenticated;
