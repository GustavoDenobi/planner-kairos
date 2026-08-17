import type { Section, SectionInput, SectionListItem } from '@/domain/ensemble';

export type SectionRepository = {
  listForGroup(organizationId: string, groupId: string): Promise<SectionListItem[]>;
  getById(organizationId: string, sectionId: string): Promise<Section | null>;
  create(organizationId: string, groupId: string, input: SectionInput): Promise<Section>;
  update(
    organizationId: string,
    sectionId: string,
    input: SectionInput,
  ): Promise<Section>;
  remove(organizationId: string, sectionId: string): Promise<void>;
  reorderSections(
    organizationId: string,
    groupId: string,
    orderedSectionIds: string[],
  ): Promise<void>;
  listPartIdsForSection(organizationId: string, sectionId: string): Promise<string[]>;
  listPartIdsByGroup(organizationId: string, groupId: string): Promise<Map<string, string[]>>;
  setSectionParts(organizationId: string, sectionId: string, partIds: string[]): Promise<void>;
};
