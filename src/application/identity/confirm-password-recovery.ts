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
  } catch {
    return Result.fail('invalid_code');
  }
}
