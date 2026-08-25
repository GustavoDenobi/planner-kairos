import type { OrganizationRules } from './legal-documents';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  imageStorageKey: string | null;
  rules: OrganizationRules | null;
};
