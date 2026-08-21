import type { PieceFileAccessScope } from '@/domain/repertoire';

export const PIECE_FILE_ACCESS_SCOPE_OPTIONS: Array<{
  value: PieceFileAccessScope;
  label: string;
}> = [
  { value: 'own_parts', label: 'Ver apenas partes próprias' },
  { value: 'all_files', label: 'Ver todos os arquivos' },
];

export function pieceFileAccessScopeLabel(scope: PieceFileAccessScope): string {
  return PIECE_FILE_ACCESS_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? scope;
}
