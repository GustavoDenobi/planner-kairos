import type { PieceFileAccessScope } from '@/domain/repertoire';

export const PIECE_FILE_ACCESS_SCOPE_OPTIONS: Array<{
  value: PieceFileAccessScope;
  label: string;
}> = [
  { value: 'own_parts', label: 'Ver apenas partes próprias' },
  { value: 'all_files', label: 'Ver todas as partituras' },
];

export const PIECE_AUDIO_ACCESS_SCOPE_OPTIONS: Array<{
  value: PieceFileAccessScope;
  label: string;
}> = [
  { value: 'own_parts', label: 'Ver áudios das partes próprias' },
  { value: 'all_files', label: 'Ver todos os áudios' },
];

export function pieceFileAccessScopeLabel(scope: PieceFileAccessScope): string {
  return PIECE_FILE_ACCESS_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? scope;
}

export function pieceAudioAccessScopeLabel(scope: PieceFileAccessScope): string {
  return PIECE_AUDIO_ACCESS_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? scope;
}
