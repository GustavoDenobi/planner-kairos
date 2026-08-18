import type { EventType, EventTypeInput } from '@/domain/agenda';

export type EventTypeRepository = {
  list(organizationId: string): Promise<EventType[]>;
  create(organizationId: string, input: EventTypeInput): Promise<EventType>;
  update(organizationId: string, typeId: string, input: EventTypeInput): Promise<EventType>;
  delete(organizationId: string, typeId: string): Promise<void>;
  countEventsUsingType(organizationId: string, typeId: string): Promise<number>;
};
