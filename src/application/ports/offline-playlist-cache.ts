export type CachedPlaylistSnapshot = {
  playlistId: string;
  organizationId: string;
  ownerUserId: string;
  name: string;
  pieceFileIds: string[];
  snapshotJson: string;
  cachedAt: string;
};

export type OfflinePlaylistCache = {
  get(playlistId: string): Promise<CachedPlaylistSnapshot | null>;
  put(snapshot: CachedPlaylistSnapshot): Promise<void>;
  remove(playlistId: string): Promise<void>;
  listForOrganization(organizationId: string): Promise<CachedPlaylistSnapshot[]>;
  clearAll(): Promise<void>;
};
