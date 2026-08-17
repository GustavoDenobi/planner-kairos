import type { PasswordRecoveryGateway } from '@/application/ports';
import { supabase } from './client';

export function createPasswordRecoveryGateway(): PasswordRecoveryGateway {
  return {
    async request(email) {
      const { error } = await supabase.functions.invoke('request-password-recovery', {
        body: { email },
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async confirm(email, code, newPassword) {
      const { data, error } = await supabase.functions.invoke('confirm-password-recovery', {
        body: { email, code, newPassword },
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
