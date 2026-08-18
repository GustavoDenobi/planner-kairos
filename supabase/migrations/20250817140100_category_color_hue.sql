-- Store category colors as hue values (0-360) instead of palette tokens

UPDATE piece_categories
SET color = CASE color
  WHEN 'blue-500' THEN '220'
  WHEN 'amber-500' THEN '38'
  WHEN 'emerald-500' THEN '160'
  WHEN 'violet-500' THEN '270'
  ELSE color
END
WHERE color IN ('blue-500', 'amber-500', 'emerald-500', 'violet-500');

CREATE OR REPLACE FUNCTION seed_piece_taxonomy(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO piece_categories (organization_id, name, slug, sort_order, color)
  VALUES
    (p_org_id, 'Instrumental', 'instrumental', 1, '220'),
    (p_org_id, 'HCA', 'hca', 2, '38'),
    (p_org_id, 'Coral', 'coral', 3, '160'),
    (p_org_id, 'Solo', 'solo', 4, '270')
  ON CONFLICT (organization_id, slug) DO NOTHING;

  INSERT INTO piece_themes (organization_id, name, slug, sort_order)
  VALUES
    (p_org_id, 'Natal', 'natal', 1),
    (p_org_id, 'Páscoa', 'pascoa', 2),
    (p_org_id, 'Ceia', 'ceia', 3),
    (p_org_id, 'Adoração', 'adoracao', 4),
    (p_org_id, 'Congresso', 'congresso', 5)
  ON CONFLICT (organization_id, slug) DO NOTHING;
END;
$$;
