import type {
  AuthGateway,
  AuthSession,
  AuthUser,
  InviteSignUpInput,
  InviteSignUpError,
} from '@/application/ports/auth-gateway';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import { supabase } from './client';

function mapUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata as Record<string, unknown>,
  };
}

function toAuthSession(session: Session): AuthSession {
  return {
    user: mapUser(session.user),
    accessToken: session.access_token,
  };
}

function mapInviteSignUpError(data: unknown): InviteSignUpError {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = String((data as { error: string }).error);
    if (error === 'email_taken' || error === 'invalid_invite' || error === 'invite_exhausted') {
      return error;
    }
  }

  return 'signup_failed';
}

function shouldPreserveSessionOffline(event: AuthChangeEvent): boolean {
  return event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED';
}

export function createAuthGateway(): AuthGateway {
  let lastKnownSession: AuthSession | null = null;

  const gateway: AuthGateway = {
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        return null;
      }
      lastKnownSession = toAuthSession(data.session);
      return lastKnownSession;
    },

    async signUp(email, password, displayName) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) {
        return null;
      }
      if (data.session) {
        lastKnownSession = toAuthSession(data.session);
        return lastKnownSession;
      }
      if (data.user) {
        return gateway.signIn(email, password);
      }
      return null;
    },

    async signUpForInvite({ token, email, password, displayName }: InviteSignUpInput) {
      const { data, error } = await supabase.functions.invoke('invite-signup', {
        body: { token, email, password, displayName },
      });

      if (error || !data || typeof data !== 'object' || !('ok' in data) || !(data as { ok: boolean }).ok) {
        return { ok: false, error: mapInviteSignUpError(data) };
      }

      const session = await gateway.signIn(email, password);
      if (!session) {
        return { ok: false, error: 'signup_failed' };
      }

      return { ok: true, session };
    },

    async signOut() {
      lastKnownSession = null;
      await supabase.auth.signOut();
    },

    async getSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        lastKnownSession = toAuthSession(data.session);
        return lastKnownSession;
      }

      if (!isBrowserOnline() && lastKnownSession) {
        return lastKnownSession;
      }

      return null;
    },

    onAuthStateChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          lastKnownSession = toAuthSession(session);
          callback(lastKnownSession);
          return;
        }

        if (!isBrowserOnline() && lastKnownSession && shouldPreserveSessionOffline(event)) {
          callback(lastKnownSession);
          return;
        }

        lastKnownSession = null;
        callback(null);
      });
      return () => data.subscription.unsubscribe();
    },
  };

  return gateway;
}
