import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthSession } from '@/application/ports';
import { useIdentity, useOffline } from '@/ui/app/AppServicesContext';

type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  userId: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const identity = useIdentity();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    identity.getSession().then((initial) => {
      if (active) {
        setSession(initial);
        setIsLoading(false);
      }
    });

    const unsubscribe = identity.onAuthStateChange((next) => {
      if (active) {
        setSession(next);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [identity]);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      userId: session?.user.id ?? null,
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function useRequireAuth() {
  const auth = useAuth();
  return auth;
}

export function useSignOut() {
  const identity = useIdentity();
  const offline = useOffline();
  return useCallback(async () => {
    await offline.clearAllOfflineData();
    await identity.signOut();
  }, [identity, offline]);
}
