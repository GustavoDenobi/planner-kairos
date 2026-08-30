import type { AuthGateway } from '@/application/ports';
import {
  clearOAuthPendingContext,
  getOAuthCallbackUrl,
  saveOAuthPendingContext,
  type OAuthPendingContext,
} from './oauth-pending-context';

export async function signInWithGoogle(auth: AuthGateway, context: OAuthPendingContext) {
  saveOAuthPendingContext(context);
  return auth.signInWithGoogle(getOAuthCallbackUrl());
}

export function cancelOAuthPendingContext() {
  clearOAuthPendingContext();
}
