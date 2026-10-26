ALTER TABLE parts
  ADD COLUMN default_transpose_semitones INT NOT NULL DEFAULT 0;

ALTER TABLE parts
  ADD CONSTRAINT parts_default_transpose_semitones_range
  CHECK (default_transpose_semitones >= -24 AND default_transpose_semitones <= 24);

COMMENT ON COLUMN parts.default_transpose_semitones IS
  'Semitones added to concert pitch in the PDF tuner (written pitch for transposing instruments).';
