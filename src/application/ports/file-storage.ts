export type FileStorage = {
  uploadBranding(organizationId: string, file: File): Promise<string>;
  remove(path: string): Promise<void>;
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
};
