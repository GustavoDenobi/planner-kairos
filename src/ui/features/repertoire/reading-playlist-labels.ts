const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: 'Nome inválido.',
  empty_playlist: 'Adicione pelo menos uma partitura.',
  invalid_file: 'Arquivo inválido.',
  invalid_file_kind: 'Apenas partituras PDF podem entrar na playlist.',
  not_found: 'Playlist não encontrada.',
  create_failed: 'Não foi possível criar a playlist.',
  delete_failed: 'Não foi possível excluir a playlist.',
};

export function readingPlaylistErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Ocorreu um erro inesperado.';
}
