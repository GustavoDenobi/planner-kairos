import type { PlatformAdminGateway } from '@/application/ports/platform-repository';
import { supabase } from './client';

export function createPlatformAdminGateway(): PlatformAdminGateway {
  return {
    async setUserPassword(userId, newPassword) {
      const { data, error } = await supabase.functions.invoke('platform-set-user-password', {
        body: { userId, newPassword },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(String((data as { error: string }).error));
      }
    },

    async deleteUser(userId) {
      const { data, error } = await supabase.functions.invoke('platform-delete-user', {
        body: { userId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(String((data as { error: string }).error));
      }
    },
  };
}
