import type { Event } from './event';
import type { EventType } from './event-type';
import type { ProgramItemDetail } from './program-item';

export type EventDetail = Event & {
  type: EventType;
  program: ProgramItemDetail[];
};
