import type { ThemePreference, UserProfile } from '@/domain/identity';

export type ProfileRepository = {
  getById(userId: string): Promise<UserProfile | null>;
  updateTheme(userId: string, theme: ThemePreference): Promise<UserProfile>;
  updateDisplayName(userId: string, displayName: string): Promise<UserProfile>;
};
