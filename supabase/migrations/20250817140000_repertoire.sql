-- Repertoire: piece categories, themes, pieces, files, and part links

CREATE TYPE piece_file_kind AS ENUM ('score', 'audio');

CREATE TABLE piece_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE piece_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES piece_categories (id) ON DELETE RESTRICT,
  composer TEXT,
  description TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pieces_org_title_active_idx ON pieces (organization_id, title)
  WHERE deleted_at IS NULL;

CREATE INDEX pieces_org_category_idx ON pieces (organization_id, category_id)
  WHERE deleted_at IS NULL;

CREATE TABLE piece_theme_links (
  piece_id UUID NOT NULL REFERENCES pieces (id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES piece_themes (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (piece_id, theme_id)
);

CREATE INDEX piece_theme_links_theme_id_idx ON piece_theme_links (theme_id);

CREATE TABLE piece_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES pieces (id) ON DELETE CASCADE,
  kind piece_file_kind NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  byte_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX piece_files_piece_id_idx ON piece_files (piece_id);

CREATE TABLE piece_file_part_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  piece_file_id UUID NOT NULL REFERENCES piece_files (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts (id) ON DELETE CASCADE,
  part_division_id UUID REFERENCES part_divisions (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX piece_file_part_links_unique_combo ON piece_file_part_links (
  piece_file_id,
  part_id,
  COALESCE(part_division_id, '00000000-0000-0000-0000-000000000000')
);

CREATE INDEX piece_file_part_links_part_id_idx ON piece_file_part_links (part_id);

-- updated_at triggers
CREATE TRIGGER piece_categories_updated_at
  BEFORE UPDATE ON piece_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER piece_themes_updated_at
  BEFORE UPDATE ON piece_themes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER pieces_updated_at
  BEFORE UPDATE ON pieces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER piece_files_updated_at
  BEFORE UPDATE ON piece_files
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Integrity: piece category must belong to same org
CREATE OR REPLACE FUNCTION check_piece_category_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM piece_categories c
    WHERE c.id = NEW.category_id
      AND c.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'piece_category_org_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pieces_check_category_org
  BEFORE INSERT OR UPDATE ON pieces
  FOR EACH ROW EXECUTE FUNCTION check_piece_category_org();

-- Integrity: piece theme links same org
CREATE OR REPLACE FUNCTION check_piece_theme_link_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_piece_org UUID;
  v_theme_org UUID;
BEGIN
  SELECT organization_id INTO v_piece_org FROM pieces WHERE id = NEW.piece_id;
  SELECT organization_id INTO v_theme_org FROM piece_themes WHERE id = NEW.theme_id;

  IF v_piece_org IS NULL OR v_theme_org IS NULL THEN
    RAISE EXCEPTION 'piece_theme_link_invalid_reference';
  END IF;

  IF v_piece_org <> NEW.organization_id OR v_theme_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_theme_link_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_theme_links_check_org
  BEFORE INSERT OR UPDATE ON piece_theme_links
  FOR EACH ROW EXECUTE FUNCTION check_piece_theme_link_org();

-- Integrity: piece file same org as piece
CREATE OR REPLACE FUNCTION check_piece_file_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_piece_org UUID;
BEGIN
  SELECT organization_id INTO v_piece_org FROM pieces WHERE id = NEW.piece_id;

  IF v_piece_org IS NULL THEN
    RAISE EXCEPTION 'piece_file_invalid_reference';
  END IF;

  IF v_piece_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_file_org_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_files_check_org
  BEFORE INSERT OR UPDATE ON piece_files
  FOR EACH ROW EXECUTE FUNCTION check_piece_file_org();

-- Integrity: piece file part links
CREATE OR REPLACE FUNCTION check_piece_file_part_link_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_file_org UUID;
  v_part_org UUID;
  v_division_part UUID;
  v_division_org UUID;
BEGIN
  SELECT organization_id INTO v_file_org FROM piece_files WHERE id = NEW.piece_file_id;
  SELECT organization_id INTO v_part_org FROM parts WHERE id = NEW.part_id;

  IF v_file_org IS NULL OR v_part_org IS NULL THEN
    RAISE EXCEPTION 'piece_file_part_link_invalid_reference';
  END IF;

  IF v_file_org <> NEW.organization_id OR v_part_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'piece_file_part_link_org_mismatch';
  END IF;

  IF NEW.part_division_id IS NOT NULL THEN
    SELECT part_id, organization_id INTO v_division_part, v_division_org
    FROM part_divisions WHERE id = NEW.part_division_id;

    IF v_division_org IS NULL OR v_division_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'piece_file_part_link_division_org_mismatch';
    END IF;

    IF v_division_part <> NEW.part_id THEN
      RAISE EXCEPTION 'piece_file_part_link_division_part_mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER piece_file_part_links_check_org
  BEFORE INSERT OR UPDATE ON piece_file_part_links
  FOR EACH ROW EXECUTE FUNCTION check_piece_file_part_link_org();

-- Seed default categories and themes for an organization
CREATE OR REPLACE FUNCTION seed_piece_taxonomy(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO piece_categories (organization_id, name, slug, sort_order, color)
  VALUES
    (p_org_id, 'Instrumental', 'instrumental', 1, 'blue-500'),
    (p_org_id, 'HCA', 'hca', 2, 'amber-500'),
    (p_org_id, 'Coral', 'coral', 3, 'emerald-500'),
    (p_org_id, 'Solo', 'solo', 4, 'violet-500')
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

CREATE OR REPLACE FUNCTION seed_piece_taxonomy_on_org_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_piece_taxonomy(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_seed_piece_taxonomy
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_piece_taxonomy_on_org_insert();

-- RLS
ALTER TABLE piece_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_theme_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_file_part_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY piece_categories_select_member ON piece_categories
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY piece_categories_write_admin ON piece_categories
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY piece_themes_select_member ON piece_themes
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY piece_themes_write_admin ON piece_themes
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY pieces_select_member ON pieces
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY pieces_write_admin ON pieces
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY piece_theme_links_select_member ON piece_theme_links
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY piece_theme_links_write_admin ON piece_theme_links
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY piece_files_select_member ON piece_files
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY piece_files_write_admin ON piece_files
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

CREATE POLICY piece_file_part_links_select_member ON piece_file_part_links
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY piece_file_part_links_write_admin ON piece_file_part_links
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']::access_role[]));

GRANT USAGE ON TYPE piece_file_kind TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  piece_categories, piece_themes, pieces, piece_theme_links, piece_files, piece_file_part_links
  TO authenticated, service_role;
GRANT SELECT ON
  piece_categories, piece_themes, pieces, piece_theme_links, piece_files, piece_file_part_links
  TO anon;

GRANT EXECUTE ON FUNCTION seed_piece_taxonomy(UUID) TO authenticated, service_role;

-- Storage: extend org-assets bucket for piece files
UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
    'application/pdf', 'audio/mpeg', 'audio/wav'
  ]
WHERE id = 'org-assets';

CREATE POLICY org_assets_insert_pieces_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-assets'
    AND has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
    AND name LIKE storage_org_id_from_path(name)::TEXT || '/pieces/%'
  );

CREATE POLICY org_assets_update_pieces_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
    AND name LIKE storage_org_id_from_path(name)::TEXT || '/pieces/%'
  )
  WITH CHECK (
    bucket_id = 'org-assets'
    AND has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
    AND name LIKE storage_org_id_from_path(name)::TEXT || '/pieces/%'
  );

CREATE POLICY org_assets_delete_pieces_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
    AND name LIKE storage_org_id_from_path(name)::TEXT || '/pieces/%'
  );
