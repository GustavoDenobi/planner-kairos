ALTER TABLE piece_files
  ADD COLUMN content_hash TEXT;

COMMENT ON COLUMN piece_files.content_hash IS 'SHA-256 hex digest of file content';

CREATE UNIQUE INDEX piece_files_piece_content_hash_unique
  ON piece_files (piece_id, content_hash)
  WHERE content_hash IS NOT NULL;
