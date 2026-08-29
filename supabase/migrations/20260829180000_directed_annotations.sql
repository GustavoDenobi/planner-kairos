-- Directed annotations: enum value must be committed before use in constraints/policies.

ALTER TYPE annotation_layer ADD VALUE IF NOT EXISTS 'directed';
