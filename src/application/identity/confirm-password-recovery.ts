import type { PasswordRecoveryGateway } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function confirmPasswordRecovery(
  gateway: PasswordRecoveryGateway,
  email: string,
  code: string,
  newPassword: string,
) {
  try {
    await gateway.confirm(email, code, newPassword);
    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('rate_limited')) {
      return Result.fail('rate_limited');
    }
    return Result.fail('invalid_code');
  }
}
