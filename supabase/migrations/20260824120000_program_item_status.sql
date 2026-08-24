-- Program item execution status (planned / performed / skipped)
CREATE TYPE program_item_status AS ENUM ('planned', 'performed', 'skipped');

ALTER TABLE program_items
  ADD COLUMN status program_item_status NOT NULL DEFAULT 'planned';
