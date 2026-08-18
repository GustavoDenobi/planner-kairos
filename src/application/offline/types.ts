export type ResolvedPieceFile =
  | { source: 'local'; data: ArrayBuffer }
  | { source: 'remote'; url: string };

export type OfflineFileStatus = 'not_cached' | 'cached' | 'stale';

export type OfflineStatus = {
  fileStatus: OfflineFileStatus;
  pendingSyncCount: number;
};

export type CachePlaylistProgress = {
  done: number;
  total: number;
  errors: string[];
};

export const OFFLINE_SIZE_WARNING_BYTES = 100 * 1024 * 1024;
