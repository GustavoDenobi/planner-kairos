-- Keep existing objects in place. Public URLs must stop serving piece files.
-- Branding and scores stay at the same storage keys; clients use signed URLs.

UPDATE storage.buckets
SET public = false
WHERE id = 'org-assets';
