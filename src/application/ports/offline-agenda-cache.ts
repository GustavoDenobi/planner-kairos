export type CachedAgendaSnapshot = {
  organizationId: string;
  userId: string;
  cachedAt: string;
  rangeFrom: string;
  rangeTo: string;
  eventsJson: string;
  eventDetailsJson: string;
  eventTypesJson: string;
  audienceJson: string;
};

export type OfflineAgendaCache = {
  get(organizationId: string, userId: string): Promise<CachedAgendaSnapshot | null>;
  put(snapshot: CachedAgendaSnapshot): Promise<void>;
  remove(organizationId: string, userId: string): Promise<void>;
  clearAll(): Promise<void>;
};
