-- Storage bucket for organization branding assets

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-assets',
  'org-assets',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION storage_org_id_from_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (split_part(p_name, '/', 1))::UUID;
$$;

CREATE POLICY org_assets_select_member ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND is_org_member(storage_org_id_from_path(name))
  );

CREATE POLICY org_assets_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-assets'
    AND has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
    AND name LIKE storage_org_id_from_path(name)::TEXT || '/branding/%'
  );

CREATE POLICY org_assets_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
  )
  WITH CHECK (
    bucket_id = 'org-assets'
    AND has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
  );

CREATE POLICY org_assets_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND has_org_role(storage_org_id_from_path(name), ARRAY['owner', 'admin']::access_role[])
  );
