ALTER TABLE piece_file_navigation_shortcuts
  ADD COLUMN color TEXT NOT NULL DEFAULT '#2563eb',
  ADD COLUMN target_x REAL CHECK (target_x IS NULL OR (target_x >= 0 AND target_x <= 1));
