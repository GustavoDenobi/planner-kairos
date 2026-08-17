import type { ProfileRepository } from '@/application/ports';
import type { ThemePreference, UserProfile } from '@/domain/identity';
import { supabase } from './client';

function mapProfile(row: {
  id: string;
  display_name: string;
  email: string;
  theme: ThemePreference;
}): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    themePreference: row.theme,
  };
}

export function createProfileRepository(): ProfileRepository {
  return {
    async getById(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, theme')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapProfile(data);
    },

    async updateTheme(userId, theme) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ theme })
        .eq('id', userId)
        .select('id, display_name, email, theme')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'profile_update_failed');
      }

      return mapProfile(data);
    },

    async updateDisplayName(userId, displayName) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', userId)
        .select('id, display_name, email, theme')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'profile_update_failed');
      }

      return mapProfile(data);
    },
  };
}
