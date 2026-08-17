import type { AuthGateway, AuthSession, AuthUser } from '@/application/ports/auth-gateway';
import type { Session, User } from '@supabase/supabase-js';
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

export function createAuthGateway(): AuthGateway {
  return {
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        return null;
      }
      return toAuthSession(data.session);
    },

    async signUp(email, password, displayName) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error || !data.session) {
        return null;
      }
      return toAuthSession(data.session);
    },

    async signOut() {
      await supabase.auth.signOut();
    },

    async getSession() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        return null;
      }
      return toAuthSession(data.session);
    },

    onAuthStateChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session ? toAuthSession(session) : null);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
