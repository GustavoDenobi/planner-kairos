import type { EventKind, ProgramItemStatus, MusicianBirthdayAssignment } from '@/domain/agenda';
import { ensembleRoleLabel } from '@/ui/features/ensemble/ensemble-labels';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  rehearsal: 'Ensaio',
  service: 'Culto',
  class: 'Aula',
  special: 'Especial',
};

export const AGENDA_ERROR_MESSAGES: Record<string, string> = {
  invalid_type: 'Selecione um tipo de evento para continuar.',
  invalid_dates: 'A data de término deve ser posterior ao início. Revise as datas informadas.',
  invalid_name: 'Informe um nome válido antes de salvar.',
  invalid_kind: 'Selecione uma categoria do tipo de evento.',
  invalid_sort_order: 'Ordem inválida. Tente reordenar novamente.',
  duplicate_name: 'Já existe um tipo com esse nome. Escolha outro nome.',
  type_in_use: 'Este tipo está em uso por eventos. Remova-o dos eventos antes de excluir.',
  delete_failed: 'Não foi possível remover. Verifique sua conexão e tente novamente.',
  invalid_piece: 'Obra inválida na programação. Selecione outra obra do repertório.',
  duplicate_piece: 'Esta obra já está no evento. Cada obra pode aparecer apenas uma vez.',
  piece_deleted: 'Esta obra foi removida do catálogo. Escolha outra obra na programação.',
  piece_not_found: 'Obra não encontrada. Ela pode ter sido removida — atualize a página.',
  not_found: 'Evento não encontrado. Ele pode ter sido removido — volte à agenda.',
  create_failed: 'Não foi possível criar o evento. Verifique os campos e tente novamente.',
  update_failed: 'Não foi possível atualizar o evento. Verifique os campos e tente novamente.',
  program_failed: 'Não foi possível salvar a programação. Tente novamente em instantes.',
  invalid_status: 'Status de execução inválido na programação.',
  cannot_create_event: 'Você não tem permissão para criar eventos.',
  audience_group_not_allowed: 'Você só pode associar grupos em que é professor ou regente.',
  audience_musician_not_allowed: 'Você só pode associar músicos dos grupos em que é professor ou regente.',
  not_allowed: 'Você não tem permissão para alterar este evento.',
  not_a_member: 'Você não faz parte desta organização.',
  invalid_musician: 'Este músico não faz parte do evento.',
  absence_failed: 'Não foi possível registrar a ausência. Tente novamente.',
};

export function agendaErrorMessage(code: string): string {
  return AGENDA_ERROR_MESSAGES[code] ?? 'Algo deu errado. Verifique sua conexão e tente novamente.';
}

export function eventKindLabel(kind: EventKind): string {
  return EVENT_KIND_LABELS[kind];
}

export const PROGRAM_ITEM_STATUS_LABELS: Record<ProgramItemStatus, string> = {
  planned: 'Planejada',
  performed: 'Executada',
  skipped: 'Não executada',
};

export function programItemStatusLabel(status: ProgramItemStatus): string {
  return PROGRAM_ITEM_STATUS_LABELS[status];
}

export function birthdayCardTitle(fullName: string, ageTurning: number | null): string {
  if (ageTurning === null) {
    return fullName;
  }
  return `${fullName} – ${ageTurning} anos`;
}

export function formatBirthdayAssignmentLabel(assignment: MusicianBirthdayAssignment): string {
  const details = [
    ensembleRoleLabel(assignment.ensembleRole),
    assignment.sectionName,
    assignment.partName,
  ]
    .filter(Boolean)
    .join(' > ');

  return details ? `${assignment.groupName} > ${details}` : assignment.groupName;
}

export function birthdayAgeLabel(ageTurning: number | null): string {
  if (ageTurning === null) {
    return 'Aniversário';
  }
  return `Completa ${ageTurning} anos`;
}
