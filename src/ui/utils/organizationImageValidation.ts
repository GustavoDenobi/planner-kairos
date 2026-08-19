export function organizationImageErrorMessage(code: string): string {
  switch (code) {
    case 'unsupported_type':
      return 'Use PNG, JPEG ou WebP.';
    case 'too_small':
      return 'A imagem deve ter pelo menos 200×200 px.';
    case 'unreadable':
      return 'Não foi possível ler a imagem.';
    default:
      return 'Não foi possível enviar a imagem.';
  }
}
