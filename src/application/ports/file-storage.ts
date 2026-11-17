export type FileStorage = {
  uploadBranding(organizationId: string, file: File): Promise<string>;
  uploadPieceFile(
    organizationId: string,
    pieceId: string,
    fileId: string,
    file: File,
    contentType: string,
  ): Promise<string>;
  /** Envia a gravação de uma tarefa de estudo para o caminho já montado pelo domínio. */
  uploadPracticeRecording(path: string, blob: Blob, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
};
