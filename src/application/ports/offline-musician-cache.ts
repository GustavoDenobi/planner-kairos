export type CachedMusiciansSnapshot = {
  organizationId: string;
  userId: string;
  cachedAt: string;
  musiciansJson: string;
  assignmentsJson: string;
  groupsJson: string;
  partsJson: string;
  sectionsJson: string;
  assignmentsByGroupJson: string;
  sectionPartIdsByGroupJson: string;
};

export type OfflineMusicianCache = {
  get(organizationId: string, userId: string): Promise<CachedMusiciansSnapshot | null>;
  put(snapshot: CachedMusiciansSnapshot): Promise<void>;
  remove(organizationId: string, userId: string): Promise<void>;
  clearAll(): Promise<void>;
};
