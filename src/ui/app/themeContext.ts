import { createContext } from 'react';
import type { ThemeContextValue } from '@/ui/app/useThemeState';

export const ThemeContext = createContext<ThemeContextValue | null>(null);
