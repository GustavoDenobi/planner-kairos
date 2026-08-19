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
  isOfflineSession: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const identity = useIdentity();
  const offline = useOffline();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const initial = await identity.getSession();
      if (!active) {
        return;
      }

      if (initial) {
        setSession(initial);
        setIsOfflineSession(false);
        setIsLoading(false);
        return;
      }

      const snapshot = await offline.getIdentitySnapshot();
      if (snapshot) {
        setSession(offline.sessionFromIdentitySnapshot(snapshot));
        setIsOfflineSession(true);
      } else {
        setSession(null);
        setIsOfflineSession(false);
      }
      setIsLoading(false);
    }

    void bootstrap();

    const unsubscribe = identity.onAuthStateChange((next) => {
      if (!active) {
        return;
      }

      if (next) {
        setSession(next);
        setIsOfflineSession(false);
        setIsLoading(false);
        return;
      }

      void offline.getIdentitySnapshot().then((snapshot) => {
        if (!active) {
          return;
        }
        if (snapshot) {
          setSession(offline.sessionFromIdentitySnapshot(snapshot));
          setIsOfflineSession(true);
        } else {
          setSession(null);
          setIsOfflineSession(false);
        }
        setIsLoading(false);
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [identity, offline]);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      userId: session?.user.id ?? null,
      isOfflineSession,
    }),
    [session, isLoading, isOfflineSession],
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
