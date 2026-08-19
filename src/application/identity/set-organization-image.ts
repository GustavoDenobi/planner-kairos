import type { FileStorage, OrganizationRepository } from '@/application/ports';
import {
  validateOrganizationImageDimensions,
  validateOrganizationImageMime,
  type OrganizationImageErrorCode,
} from '@/domain/identity';
import { Result } from '@/domain/shared';

import { readImageFileDimensions } from './read-image-file-dimensions';

export async function setOrganizationImage(
  orgRepo: OrganizationRepository,
  fileStorage: FileStorage,
  organizationId: string,
  file: File,
  currentImageKey: string | null,
) {
  const mimeError = validateOrganizationImageMime(file.type);
  if (mimeError) {
    return Result.fail<OrganizationImageErrorCode>(mimeError);
  }

  const dimensions = await readImageFileDimensions(file);
  if (!dimensions) {
    return Result.fail<OrganizationImageErrorCode>('unreadable');
  }

  const sizeError = validateOrganizationImageDimensions(dimensions.width, dimensions.height);
  if (sizeError) {
    return Result.fail<OrganizationImageErrorCode>(sizeError);
  }

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
