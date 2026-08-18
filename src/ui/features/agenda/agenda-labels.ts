import type { EventKind } from '@/domain/agenda';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  rehearsal: 'Ensaio',
  service: 'Culto',
  class: 'Aula',
  special: 'Especial',
};

export const AGENDA_ERROR_MESSAGES: Record<string, string> = {
  invalid_type: 'Selecione um tipo de evento.',
  invalid_dates: 'Informe datas válidas (término após início).',
  invalid_name: 'Informe um nome válido.',
  invalid_kind: 'Selecione uma categoria do tipo.',
  invalid_sort_order: 'Ordem inválida.',
  duplicate_name: 'Já existe um tipo com esse nome.',
  type_in_use: 'Tipo em uso por eventos da agenda.',
  delete_failed: 'Não foi possível remover.',
  invalid_piece: 'Obra inválida na programação.',
  duplicate_piece: 'A mesma obra não pode aparecer duas vezes no evento.',
  piece_deleted: 'Esta obra foi removida do catálogo e não pode ser adicionada.',
  piece_not_found: 'Obra não encontrada.',
  not_found: 'Evento não encontrado.',
  create_failed: 'Não foi possível criar o evento.',
  update_failed: 'Não foi possível atualizar o evento.',
  program_failed: 'Não foi possível salvar a programação.',
};

export function agendaErrorMessage(code: string): string {
  return AGENDA_ERROR_MESSAGES[code] ?? 'Ocorreu um erro. Tente novamente.';
}

export function eventKindLabel(kind: EventKind): string {
  return EVENT_KIND_LABELS[kind];
}
