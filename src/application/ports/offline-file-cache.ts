export type CachedPieceFileMeta = {
  pieceFileId: string;
  organizationId: string;
  pieceId: string;
  contentHash: string | null;
  byteSize: number | null;
  title: string;
  cachedAt: string;
};

export type OfflineFileCache = {
  get(pieceFileId: string): Promise<CachedPieceFileMeta | null>;
  getBlob(pieceFileId: string): Promise<Blob | null>;
  put(entry: CachedPieceFileMeta & { blob: Blob }): Promise<void>;
  remove(pieceFileId: string): Promise<void>;
  listForOrganization(organizationId: string): Promise<CachedPieceFileMeta[]>;
  isStale(pieceFileId: string, contentHash: string | null): Promise<boolean>;
  clearAll(): Promise<void>;
};
