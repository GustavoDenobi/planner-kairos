import type { EventTypeRepository } from '@/application/ports/event-type-repository';
import type { EventTypeInput } from '@/domain/agenda';
import { validateEventTypeInput } from '@/domain/agenda';
import { Result } from '@/domain/shared';

export async function listEventTypes(
  eventTypeRepo: EventTypeRepository,
  organizationId: string,
) {
  const types = await eventTypeRepo.list(organizationId);
  return Result.ok(types);
}

export async function createEventType(
  eventTypeRepo: EventTypeRepository,
  organizationId: string,
  input: EventTypeInput,
) {
  const validationError = validateEventTypeInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const eventType = await eventTypeRepo.create(organizationId, input);
    return Result.ok(eventType);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_name');
    }
    return Result.fail('create_failed');
  }
}

export async function updateEventType(
  eventTypeRepo: EventTypeRepository,
  organizationId: string,
  typeId: string,
  input: EventTypeInput,
) {
  const validationError = validateEventTypeInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const eventType = await eventTypeRepo.update(organizationId, typeId, input);
    return Result.ok(eventType);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_name');
    }
    return Result.fail('update_failed');
  }
}

export async function deleteEventType(
  eventTypeRepo: EventTypeRepository,
  organizationId: string,
  typeId: string,
) {
  const count = await eventTypeRepo.countEventsUsingType(organizationId, typeId);
  if (count > 0) {
    return Result.fail('type_in_use');
  }

  try {
    await eventTypeRepo.delete(organizationId, typeId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}
