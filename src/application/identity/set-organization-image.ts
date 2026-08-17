import type { FileStorage, OrganizationRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function setOrganizationImage(
  orgRepo: OrganizationRepository,
  fileStorage: FileStorage,
  organizationId: string,
  file: File,
  currentImageKey: string | null,
) {
  const storageKey = await fileStorage.uploadBranding(organizationId, file);
  const org = await orgRepo.updateImageKey(organizationId, storageKey);

  if (currentImageKey && currentImageKey !== storageKey) {
    try {
      await fileStorage.remove(currentImageKey);
    } catch {
      // non-fatal if old file already removed
    }
  }

  return Result.ok(org);
}
