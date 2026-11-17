import type { OrganizationRepository } from '@/application/ports';
import type { Organization } from '@/domain/identity';
import { isValidTimeZone } from '@/domain/practice';
import { Result } from '@/domain/shared';

/** Fuso da organização: define o "hoje" das tarefas diárias. */
export async function setOrganizationTimeZone(
  orgRepo: OrganizationRepository,
  organizationId: string,
  timeZone: string,
): Promise<Result<Organization, 'invalid_time_zone' | 'save_failed'>> {
  const trimmed = timeZone.trim();
  if (!trimmed || !isValidTimeZone(trimmed)) {
    return Result.fail('invalid_time_zone');
  }
  try {
    return Result.ok(await orgRepo.updateTimeZone(organizationId, trimmed));
  } catch {
    return Result.fail('save_failed');
  }
}
