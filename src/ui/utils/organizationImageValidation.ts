export function organizationImageErrorMessage(code: string): string {
  switch (code) {
    case 'unsupported_type':
      return 'Formato não suportado. Envie uma imagem PNG, JPEG ou WebP.';
    case 'too_small':
      return 'A imagem é pequena demais. Use pelo menos 200×200 pixels.';
    case 'unreadable':
      return 'Não foi possível ler a imagem. Tente outro arquivo.';
    default:
      return 'Não foi possível enviar a imagem. Verifique o arquivo e tente novamente.';
  }
}
