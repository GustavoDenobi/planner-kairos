import type { PieceFileOrganization } from './piece-file-organization';

export function pieceFileOrganizationLabel(mode: PieceFileOrganization): string {
  switch (mode) {
    case 'distributed':
      return 'Arquivos separados por partes (instrumentos)';
    case 'sequential':
      return 'Arquivos separados por lições sequenciais';
    default:
      return 'Arquivo único';
  }
}

export function pieceFileOrganizationDescription(mode: PieceFileOrganization): string {
  switch (mode) {
    case 'distributed':
      return 'Cada arquivo corresponde a uma ou mais partes ou instrumentos.';
    case 'sequential':
      return 'Arquivos ordenados como lições ou unidades do mesmo conteúdo.';
    default:
      return 'Apenas um arquivo.';
  }
}
