-- Structured score reference on playlist items (page range, TOC entry, or shortcut).

CREATE TYPE reading_playlist_item_reference_kind AS ENUM ('page', 'toc', 'shortcut');

ALTER TABLE reading_playlist_items
  ADD COLUMN reference_kind reading_playlist_item_reference_kind,
  ADD COLUMN start_page INT CHECK (start_page IS NULL OR start_page > 0),
  ADD COLUMN end_page INT CHECK (end_page IS NULL OR end_page > 0),
  ADD COLUMN piece_file_toc_entry_id UUID,
  ADD COLUMN navigation_shortcut_id UUID,
  ADD CONSTRAINT reading_playlist_items_page_range_check CHECK (
    start_page IS NULL
    OR end_page IS NULL
    OR end_page >= start_page
  );

-- Existing items stored the opening page as the suffix "Abrir na p. N" inside notes.
UPDATE reading_playlist_items
SET
  start_page = (regexp_match(notes, 'Abrir na p\.[[:space:]]*([0-9]+)[[:space:]]*$', 'i'))[1]::int,
  reference_kind = 'page',
  notes = NULLIF(
    btrim(
      regexp_replace(
        notes,
        '([[:space:]]*·[[:space:]]*)?Abrir na p\.[[:space:]]*[0-9]+[[:space:]]*$',
        '',
        'i'
      )
    ),
    ''
  )
WHERE notes ~* '([[:space:]]*·[[:space:]]*)?Abrir na p\.[[:space:]]*[0-9]+[[:space:]]*$'
  AND (regexp_match(notes, 'Abrir na p\.[[:space:]]*([0-9]+)[[:space:]]*$', 'i'))[1]::int > 0;

ALTER TABLE reading_playlist_items
  ADD CONSTRAINT reading_playlist_items_reference_check CHECK (
    (
      reference_kind IS NULL
      AND start_page IS NULL
      AND end_page IS NULL
      AND piece_file_toc_entry_id IS NULL
      AND navigation_shortcut_id IS NULL
    )
    OR (
      reference_kind = 'page'
      AND piece_file_toc_entry_id IS NULL
      AND navigation_shortcut_id IS NULL
      AND (start_page IS NOT NULL OR end_page IS NOT NULL)
    )
    OR (
      reference_kind = 'toc'
      AND piece_file_toc_entry_id IS NOT NULL
      AND navigation_shortcut_id IS NULL
      AND start_page IS NULL
      AND end_page IS NULL
    )
    OR (
      reference_kind = 'shortcut'
      AND navigation_shortcut_id IS NOT NULL
      AND piece_file_toc_entry_id IS NULL
      AND start_page IS NULL
      AND end_page IS NULL
    )
  );

ALTER TABLE reading_playlist_items
  ADD CONSTRAINT reading_playlist_items_piece_file_toc_entry_id_fkey
    FOREIGN KEY (piece_file_toc_entry_id)
    REFERENCES piece_file_toc_entries (id)
    ON DELETE SET NULL,
  ADD CONSTRAINT reading_playlist_items_navigation_shortcut_id_fkey
    FOREIGN KEY (navigation_shortcut_id)
    REFERENCES piece_file_navigation_shortcuts (id)
    ON DELETE SET NULL;

CREATE INDEX reading_playlist_items_toc_entry_idx
  ON reading_playlist_items (piece_file_toc_entry_id)
  WHERE piece_file_toc_entry_id IS NOT NULL;

CREATE INDEX reading_playlist_items_shortcut_idx
  ON reading_playlist_items (navigation_shortcut_id)
  WHERE navigation_shortcut_id IS NOT NULL;

CREATE OR REPLACE FUNCTION check_reading_playlist_item_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_toc_org UUID;
  v_toc_file UUID;
  v_shortcut_org UUID;
  v_shortcut_file UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.reference_kind = 'toc'
       AND NEW.piece_file_toc_entry_id IS NULL
       AND OLD.piece_file_toc_entry_id IS NOT NULL THEN
      NEW.reference_kind := NULL;
    END IF;

    IF NEW.reference_kind = 'shortcut'
       AND NEW.navigation_shortcut_id IS NULL
       AND OLD.navigation_shortcut_id IS NOT NULL THEN
      NEW.reference_kind := NULL;
    END IF;
  END IF;

  IF NEW.piece_file_toc_entry_id IS NOT NULL THEN
    SELECT organization_id, piece_file_id
    INTO v_toc_org, v_toc_file
    FROM piece_file_toc_entries
    WHERE id = NEW.piece_file_toc_entry_id;

    IF v_toc_org IS NULL THEN
      RAISE EXCEPTION 'reading_playlist_item_invalid_toc_entry';
    END IF;

    IF v_toc_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'reading_playlist_item_toc_org_mismatch';
    END IF;

    IF v_toc_file <> NEW.piece_file_id THEN
      RAISE EXCEPTION 'reading_playlist_item_toc_file_mismatch';
    END IF;
  END IF;

  IF NEW.navigation_shortcut_id IS NOT NULL THEN
    SELECT organization_id, piece_file_id
    INTO v_shortcut_org, v_shortcut_file
    FROM piece_file_navigation_shortcuts
    WHERE id = NEW.navigation_shortcut_id;

    IF v_shortcut_org IS NULL THEN
      RAISE EXCEPTION 'reading_playlist_item_invalid_navigation_shortcut';
    END IF;

    IF v_shortcut_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'reading_playlist_item_shortcut_org_mismatch';
    END IF;

    IF v_shortcut_file <> NEW.piece_file_id THEN
      RAISE EXCEPTION 'reading_playlist_item_shortcut_file_mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reading_playlist_items_check_reference
  BEFORE INSERT OR UPDATE ON reading_playlist_items
  FOR EACH ROW EXECUTE FUNCTION check_reading_playlist_item_reference();
