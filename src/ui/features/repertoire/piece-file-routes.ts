export function piecePdfViewerPath(orgSlug: string, pieceId: string, fileId: string): string {
  return `/${orgSlug}/repertorio/${pieceId}/arquivo/${fileId}`;
}

export function pieceDetailPath(orgSlug: string, pieceId: string): string {
  return `/${orgSlug}/repertorio/${pieceId}`;
}
