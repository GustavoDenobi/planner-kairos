export type PartKind = 'instrument' | 'voice';

export type Part = {
  id: string;
  organizationId: string;
  name: string;
  kind: PartKind;
  sortOrder: number;
};

export type PartInput = {
  name: string;
  kind: PartKind;
  sortOrder?: number;
};
