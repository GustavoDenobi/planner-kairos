export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

export type InviteSignUpInput = {
  token: string;
  email: string;
  password: string;
  displayName: string;
};

export type InviteSignUpError =
  | 'signup_failed'
  | 'email_taken'
  | 'invalid_invite'
  | 'invite_exhausted';

export type InviteSignUpResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: InviteSignUpError };

export type MusicianClaimSignUpInput = {
  musicianId: string;
  email: string;
  password: string;
  displayName: string;
};

export type MusicianClaimSignUpError =
  | 'signup_failed'
  | 'email_taken'
  | 'not_found'
  | 'already_claimed';

export type MusicianClaimSignUpResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: MusicianClaimSignUpError };

export type AuthGateway = {
  signIn(email: string, password: string): Promise<AuthSession | null>;
  signUp(email: string, password: string, displayName: string): Promise<AuthSession | null>;
  signUpForInvite(input: InviteSignUpInput): Promise<InviteSignUpResult>;
  signUpForMusicianClaim(input: MusicianClaimSignUpInput): Promise<MusicianClaimSignUpResult>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
  signInWithGoogle(redirectTo: string): Promise<{ ok: true } | { ok: false }>;
};
