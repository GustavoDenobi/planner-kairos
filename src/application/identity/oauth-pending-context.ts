import type { OrganizationRules } from '@/domain/identity/legal-documents';

export const OAUTH_PENDING_STORAGE_KEY = 'planner-kairos:oauth-pending';
const OAUTH_PENDING_TTL_MS = 10 * 60 * 1000;

export type OAuthPendingContext =
  | { kind: 'login' }
  | { kind: 'invite_login'; returnPath: string }
  | { kind: 'musician_login'; returnPath: string }
  | {
      kind: 'invite_signup';
      token: string;
      displayName: string;
      phone: string;
      birthDate: string;
      organizationId?: string;
      organizationRules?: OrganizationRules | null;
      organizationRulesAccepted?: boolean;
      fallbackPath: string;
    }
  | {
      kind: 'musician_signup';
      musicianId: string;
      displayName: string;
      phone: string;
      birthDate: string;
      organizationId?: string;
      organizationRules?: OrganizationRules | null;
      organizationRulesAccepted?: boolean;
      fallbackPath: string;
    };

type StoredOAuthPendingContext = {
  savedAt: number;
  context: OAuthPendingContext;
};

export function getOAuthCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export function saveOAuthPendingContext(context: OAuthPendingContext): void {
  const payload: StoredOAuthPendingContext = {
    savedAt: Date.now(),
    context,
  };
  sessionStorage.setItem(OAUTH_PENDING_STORAGE_KEY, JSON.stringify(payload));
}

export function readOAuthPendingContext(): OAuthPendingContext | null {
  const raw = sessionStorage.getItem(OAUTH_PENDING_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredOAuthPendingContext;
    if (!parsed.context || typeof parsed.savedAt !== 'number') {
      return null;
    }

    if (Date.now() - parsed.savedAt > OAUTH_PENDING_TTL_MS) {
      clearOAuthPendingContext();
      return null;
    }

    return parsed.context;
  } catch {
    return null;
  }
}

export function clearOAuthPendingContext(): void {
  sessionStorage.removeItem(OAUTH_PENDING_STORAGE_KEY);
}

export type ResumeOAuthPendingActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; redirectTo: string };
