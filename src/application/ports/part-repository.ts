import type { Part, PartDivision, PartDivisionInput, PartInput } from '@/domain/ensemble';

export type PartWithDivisions = Part & {
  divisions: PartDivision[];
};

export type PartRepository = {
  listForOrg(organizationId: string): Promise<PartWithDivisions[]>;
  getById(organizationId: string, partId: string): Promise<PartWithDivisions | null>;
  create(organizationId: string, input: PartInput): Promise<Part>;
  update(organizationId: string, partId: string, input: PartInput): Promise<Part>;
  addDivision(
    organizationId: string,
    partId: string,
    input: PartDivisionInput,
  ): Promise<PartDivision>;
  updateDivision(
    organizationId: string,
    divisionId: string,
    input: PartDivisionInput,
  ): Promise<PartDivision>;
  removeDivision(organizationId: string, divisionId: string): Promise<void>;
  reorderParts(organizationId: string, orderedPartIds: string[]): Promise<void>;
};
