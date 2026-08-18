import type {
  ListMusiciansOptions,
  MusicianRepository,
} from '@/application/ports/musician-repository';
import type { MusicianInput } from '@/domain/ensemble';
import { normalizePhone, validateMusicianInput } from '@/domain/ensemble';
import { Result } from '@/domain/shared';

export async function listMusicians(
  musicianRepo: MusicianRepository,
  organizationId: string,
  options?: ListMusiciansOptions,
) {
  const musicians = await musicianRepo.listForOrg(organizationId, options);
  return Result.ok(musicians);
}

export async function getMusician(
  musicianRepo: MusicianRepository,
  organizationId: string,
  musicianId: string,
) {
  const musician = await musicianRepo.getById(organizationId, musicianId);
  if (!musician) {
    return Result.fail('not_found');
  }
  return Result.ok(musician);
}

export async function getMyMusician(
  musicianRepo: MusicianRepository,
  organizationId: string,
  userId: string,
) {
  const musician = await musicianRepo.getByUserId(organizationId, userId);
  if (!musician) {
    return Result.fail('not_found');
  }
  return Result.ok(musician);
}

export async function updateMusician(
  musicianRepo: MusicianRepository,
  organizationId: string,
  musicianId: string,
  input: MusicianInput,
) {
  const validationError = validateMusicianInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;

  try {
    const musician = await musicianRepo.update(organizationId, musicianId, {
      ...input,
      fullName: input.fullName.trim(),
      phone,
      email,
    });
    return Result.ok(musician);
  } catch {
    return Result.fail('update_failed');
  }
}

export async function deleteMusician(
  musicianRepo: MusicianRepository,
  organizationId: string,
  musicianId: string,
) {
  try {
    await musicianRepo.delete(organizationId, musicianId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}
