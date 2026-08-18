DROP INDEX IF EXISTS piece_files_piece_content_hash_unique;

CREATE INDEX IF NOT EXISTS piece_files_piece_content_hash_idx
  ON piece_files (piece_id, content_hash)
  WHERE content_hash IS NOT NULL;
