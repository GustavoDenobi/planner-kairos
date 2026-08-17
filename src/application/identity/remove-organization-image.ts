import type { FileStorage, OrganizationRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function removeOrganizationImage(
  orgRepo: OrganizationRepository,
  fileStorage: FileStorage,
  organizationId: string,
  currentImageKey: string | null,
) {
  if (currentImageKey) {
    try {
      await fileStorage.remove(currentImageKey);
    } catch {
      // non-fatal
    }
  }

  const org = await orgRepo.clearImage(organizationId);
  return Result.ok(org);
}
