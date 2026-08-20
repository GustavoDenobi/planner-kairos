import type { EnsembleRole, PartKind } from '@/domain/ensemble';

export const PART_KIND_OPTIONS: { value: PartKind; label: string }[] = [
  { value: 'instrument', label: 'Instrumento' },
  { value: 'voice', label: 'Voz' },
];

export function partKindLabel(kind: PartKind): string {
  return PART_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}

export const ENSEMBLE_ROLE_OPTIONS: { value: EnsembleRole; label: string }[] = [
  { value: 'member', label: 'Integrante' },
  { value: 'teacher', label: 'Professor' },
  { value: 'section_lead', label: 'Chefe de naipe' },
  { value: 'conductor', label: 'Regente' },
];

export function ensembleRoleLabel(role: EnsembleRole): string {
  return ENSEMBLE_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}
