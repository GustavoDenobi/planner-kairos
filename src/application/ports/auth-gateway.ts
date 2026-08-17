export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

export type AuthGateway = {
  signIn(email: string, password: string): Promise<AuthSession | null>;
  signUp(email: string, password: string, displayName: string): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
};
