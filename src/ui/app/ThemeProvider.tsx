import type { ReactNode } from 'react';
import { ThemeContext } from '@/ui/app/themeContext';
import { useThemeState } from '@/ui/app/useThemeState';

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const value = useThemeState();

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
