import type { ProfileRepository } from '@/application/ports';
import type { ThemePreference } from '@/domain/identity';
import { Result } from '@/domain/shared';

export async function setThemePreference(
  profileRepo: ProfileRepository,
  userId: string,
  theme: ThemePreference,
) {
  const profile = await profileRepo.updateTheme(userId, theme);
  return Result.ok(profile);
}
