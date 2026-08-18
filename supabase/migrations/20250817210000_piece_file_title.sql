ALTER TABLE piece_files
  ADD COLUMN title TEXT;

UPDATE piece_files
SET title = regexp_replace(original_name, '\.[^.]*$', '');

ALTER TABLE piece_files
  ALTER COLUMN title SET NOT NULL;
