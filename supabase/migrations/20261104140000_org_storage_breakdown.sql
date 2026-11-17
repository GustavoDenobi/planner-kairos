-- Armazenamento por tipo de conteúdo (mostrador do plano nas configurações da organização).
--
-- Também corrige a contagem: get_org_storage_bytes somava piece_files.byte_size E todos os
-- objetos do storage da organização — que já incluem os PDFs/áudios das peças —, então cada
-- arquivo de peça contava duas vezes. A fonte agora é só o storage (o que ocupa espaço de fato),
-- e piece_files serve apenas para saber se o objeto é partitura ou áudio.

CREATE OR REPLACE FUNCTION org_storage_breakdown_unchecked(p_org_id UUID)
RETURNS TABLE (category TEXT, bytes BIGINT, file_count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT
    CASE
      WHEN pf.kind = 'score' THEN 'piece_score'
      WHEN pf.kind = 'audio' THEN 'piece_audio'
      WHEN split_part(o.name, '/', 2) = 'practice' THEN 'practice_audio'
      WHEN split_part(o.name, '/', 2) = 'branding' THEN 'branding'
      ELSE 'other'
    END AS category,
    COALESCE(SUM((o.metadata->>'size')::BIGINT), 0)::BIGINT AS bytes,
    COUNT(*)::INTEGER AS file_count
  FROM storage.objects o
  LEFT JOIN piece_files pf
    ON pf.organization_id = p_org_id
   AND pf.storage_key = o.name
  WHERE o.bucket_id = 'org-assets'
    AND o.name LIKE p_org_id::TEXT || '/%'
  GROUP BY 1;
$$;

REVOKE ALL ON FUNCTION org_storage_breakdown_unchecked(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION get_org_storage_breakdown(p_org_id UUID)
RETURNS TABLE (category TEXT, bytes BIGINT, file_count INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT is_org_member(p_org_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY SELECT * FROM org_storage_breakdown_unchecked(p_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION get_org_storage_breakdown(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION get_org_storage_bytes(p_org_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT is_org_member(p_org_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN (SELECT COALESCE(SUM(b.bytes), 0)::BIGINT FROM org_storage_breakdown_unchecked(p_org_id) b);
END;
$$;

-- O arquivo da peça é enviado ao storage antes da linha em piece_files: ele já entra no uso
-- atual. Somar o tamanho de novo o contaria duas vezes na checagem do limite.
CREATE OR REPLACE FUNCTION check_piece_files_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  PERFORM assert_org_plan_limit(
    NEW.organization_id,
    'storage',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'org-assets' AND o.name = NEW.storage_key
      ) THEN 0
      ELSE COALESCE(NEW.byte_size, 0)
    END
  );
  RETURN NEW;
END;
$$;
