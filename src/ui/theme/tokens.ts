export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

/** Cor da barra de status do navegador/PWA — alinhada ao fundo da página. */
export const themeColor = {
  light: '#f0f1f4',
  dark: '#09090b',
} as const;

export function getThemeColor(mode: ThemeMode): string {
  return themeColor[mode];
}

export const colors = {
  light: {
    bg: '#f0f1f4',
    surface: '#ffffff',
    primary: '#4f46e5',
    accent: '#f59e0b',
    text: '#18181b',
    muted: '#52525b',
    border: '#d0d3da',
  },
  dark: {
    bg: '#09090b',
    surface: '#18181b',
    primary: '#818cf8',
    accent: '#fbbf24',
    text: '#f4f4f5',
    muted: '#a1a1aa',
    border: '#27272a',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
} as const;

export const spacing = {
  sidebarWidth: '16rem',
  headerHeight: '3.5rem',
  bottomNavHeight: '4rem',
} as const;
