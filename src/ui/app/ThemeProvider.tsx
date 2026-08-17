import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { ThemeContext } from '@/ui/app/themeContext';
import { useThemeState } from '@/ui/app/useThemeState';
import type { ThemeMode } from '@/ui/theme/tokens';

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const value = useThemeState();
  const { userId } = useAuth();
  const identity = useIdentity();
  const { theme, setTheme } = value;
  const profileSyncedRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    profileSyncedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!userId || profileSyncedRef.current) {
      return;
    }

    let active = true;
    identity.getProfile(userId).then((profile) => {
      if (!active || !profile) {
        return;
      }
      profileSyncedRef.current = true;
      skipNextSaveRef.current = true;
      setTheme(profile.themePreference as ThemeMode);
    });

    return () => {
      active = false;
    };
  }, [userId, identity, setTheme]);

  useEffect(() => {
    if (!userId || !profileSyncedRef.current) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      identity.setThemePreference(userId, theme);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [userId, identity, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
