export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  themePreference: ThemePreference;
};

export type ThemePreference = 'light' | 'dark';
