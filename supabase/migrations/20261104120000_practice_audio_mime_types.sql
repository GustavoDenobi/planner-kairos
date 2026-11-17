-- Entregas de tarefas: o bucket org-assets só aceitava audio/mpeg e audio/wav,
-- mas o MediaRecorder grava WebM (Chrome/Android/Firefox) ou MP4/AAC (Safari, Chrome recente).
UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT mime ORDER BY mime)
  FROM unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[])
    || ARRAY['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/x-m4a']
  ) AS mime
)
WHERE id = 'org-assets'
  AND allowed_mime_types IS NOT NULL;
