export type PartDivision = {
  id: string;
  organizationId: string;
  partId: string;
  name: string;
  sortOrder: number;
};

export type PartDivisionInput = {
  name: string;
  sortOrder?: number;
};
