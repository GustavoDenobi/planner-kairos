import type { GroupKind } from '@/domain/ensemble';

export const GROUP_KIND_OPTIONS: { value: GroupKind; label: string }[] = [
  { value: 'ensemble', label: 'Formação instrumental' },
  { value: 'choir', label: 'Coral' },
  { value: 'class', label: 'Turma / aula' },
  { value: 'other', label: 'Outro' },
];

export function groupKindLabel(kind: GroupKind): string {
  return GROUP_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}
