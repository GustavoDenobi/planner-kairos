const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: 'Informe um nome para a playlist antes de salvar.',
  empty_playlist: 'Adicione pelo menos uma partitura PDF à playlist.',
  invalid_file: 'Arquivo inválido. Selecione outra partitura do repertório.',
  invalid_file_kind: 'Apenas partituras PDF podem entrar na playlist.',
  not_found: 'Playlist não encontrada. Ela pode ter sido removida — volte à lista.',
  create_failed: 'Não foi possível criar a playlist. Verifique o nome e tente novamente.',
  delete_failed: 'Não foi possível excluir a playlist. Verifique sua conexão e tente novamente.',
};

export function readingPlaylistErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Algo deu errado. Verifique sua conexão e tente novamente.';
}
