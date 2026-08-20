const OFFLINE_ERROR_MESSAGES: Record<string, string> = {
  offline: 'Sem conexão. Conecte-se à internet para baixar.',
  not_found: 'Arquivo não encontrado. Atualize a página e tente novamente.',
  download_failed: 'Não foi possível baixar. Verifique a conexão e tente de novo.',
  hash_mismatch: 'O arquivo baixado está corrompido. Tente baixar novamente.',
  offline_not_cached: 'Partitura não disponível offline. Com conexão, os arquivos das playlists são salvos automaticamente neste dispositivo.',
  signed_url_failed: 'Não foi possível acessar o arquivo no servidor. Tente novamente em instantes.',
};

export function offlineErrorMessage(code: string): string {
  return (
    OFFLINE_ERROR_MESSAGES[code] ??
    'Não foi possível concluir o download. Verifique a conexão e tente novamente.'
  );
}
