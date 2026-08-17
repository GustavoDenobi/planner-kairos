import type { PasswordRecoveryGateway } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function requestPasswordRecovery(
  gateway: PasswordRecoveryGateway,
  email: string,
) {
  await gateway.request(email);
  return Result.ok(undefined);
}
