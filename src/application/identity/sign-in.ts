import { Result } from '@/domain/shared';
import type { AuthGateway } from '@/application/ports';

export type SignInInput = {
  email: string;
  password: string;
};

export async function signIn(auth: AuthGateway, input: SignInInput) {
  const session = await auth.signIn(input.email, input.password);
  if (!session) {
    return Result.fail('invalid_credentials');
  }
  return Result.ok(session);
}
