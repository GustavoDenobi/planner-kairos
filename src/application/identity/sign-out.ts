import type { AuthGateway } from '@/application/ports';
import { Result } from '@/domain/shared';

export async function signOut(auth: AuthGateway) {
  await auth.signOut();
  return Result.ok(undefined);
}
