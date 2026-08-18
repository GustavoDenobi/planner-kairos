export function readingPlaylistsPath(orgSlug: string): string {
  return `/${orgSlug}/leitura`;
}

export function readingPlaylistNewPath(orgSlug: string): string {
  return `/${orgSlug}/leitura/novo`;
}

export function readingPlaylistEditPath(orgSlug: string, playlistId: string): string {
  return `/${orgSlug}/leitura/${playlistId}`;
}

export function prepareReadingPlaylistPath(orgSlug: string, eventId: string): string {
  return `/${orgSlug}/eventos/${eventId}/preparar-partituras`;
}

export function readingPlaylistReaderPath(
  orgSlug: string,
  playlistId: string,
  itemIndex: number,
): string {
  return `/${orgSlug}/leitura/${playlistId}/${itemIndex}`;
}
