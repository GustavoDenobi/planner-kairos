-- Fix storage_piece_file_id_from_path for org-assets RLS on piece files.
--
-- Previous implementations parsed the UUID embedded in the filename segment, but
-- piece_files.id did not always match that UUID (upload used a client UUID while
-- the row id was generated separately). That caused can_access_piece_file to
-- fail and Storage to return 404 NoSuchKey for existing files.
--
-- Resolve the piece file by storage_key (exact object path) instead.

CREATE OR REPLACE FUNCTION storage_piece_file_id_from_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM piece_files WHERE storage_key = p_name LIMIT 1;
$$;

CREATE INDEX IF NOT EXISTS piece_files_storage_key_idx ON piece_files (storage_key);
