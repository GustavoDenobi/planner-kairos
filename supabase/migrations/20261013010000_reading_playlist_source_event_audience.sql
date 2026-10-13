-- Snapshot da audiência do evento no momento em que a playlist é criada.
-- Usado para ligar automaticamente as camadas dirigidas da aula, mesmo offline.

ALTER TABLE reading_playlists
  ADD COLUMN source_event_musician_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN source_event_group_ids UUID[] NOT NULL DEFAULT '{}';

UPDATE reading_playlists AS playlist
SET source_event_musician_ids = COALESCE(
  (
    SELECT array_agg(event_musician.musician_id)
    FROM event_musicians AS event_musician
    WHERE event_musician.event_id = playlist.source_event_id
  ),
  '{}'
)
WHERE playlist.source_event_id IS NOT NULL;

UPDATE reading_playlists AS playlist
SET source_event_group_ids = COALESCE(
  (
    SELECT array_agg(event_group.group_id)
    FROM event_groups AS event_group
    WHERE event_group.event_id = playlist.source_event_id
  ),
  '{}'
)
WHERE playlist.source_event_id IS NOT NULL;
