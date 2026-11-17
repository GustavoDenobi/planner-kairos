import type { OrganizationRules } from './legal-documents';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  imageStorageKey: string | null;
  /** Fuso IANA (ex.: America/Sao_Paulo): define o "hoje" das tarefas diárias. */
  timeZone: string;
  rules: OrganizationRules | null;
};
