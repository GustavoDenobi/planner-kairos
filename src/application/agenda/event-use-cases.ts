import type { EventRepository, ListEventsInRangeOptions } from '@/application/ports/event-repository';
import type { EventInput } from '@/domain/agenda';
import { validateEventInput } from '@/domain/agenda';
import { Result } from '@/domain/shared';

export async function listEventsInRange(
  eventRepo: EventRepository,
  organizationId: string,
  options: ListEventsInRangeOptions,
) {
  const events = await eventRepo.listInRange(organizationId, options);
  return Result.ok(events);
}

export async function getEvent(
  eventRepo: EventRepository,
  organizationId: string,
  eventId: string,
) {
  const event = await eventRepo.getById(organizationId, eventId);
  if (!event) {
    return Result.fail('not_found');
  }
  return Result.ok(event);
}

export async function scheduleEvent(
  eventRepo: EventRepository,
  organizationId: string,
  input: EventInput,
) {
  const validationError = validateEventInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const event = await eventRepo.create(organizationId, input);
    return Result.ok(event);
  } catch {
    return Result.fail('create_failed');
  }
}

export async function updateEvent(
  eventRepo: EventRepository,
  organizationId: string,
  eventId: string,
  input: EventInput,
) {
  const validationError = validateEventInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const existing = await eventRepo.getById(organizationId, eventId);
  if (!existing) {
    return Result.fail('not_found');
  }

  try {
    const event = await eventRepo.update(organizationId, eventId, input);
    return Result.ok(event);
  } catch {
    return Result.fail('update_failed');
  }
}
