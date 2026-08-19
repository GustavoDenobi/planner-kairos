import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AuthSession } from '@/application/ports/auth-gateway';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

const mockGetSession = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock('./client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

import { createAuthGateway } from '@/infrastructure/supabase/auth-gateway';

function createSupabaseSession(): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: 'musico@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
}

describe('auth-gateway offline session preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns last known session when getSession is empty offline', async () => {
    const gateway = createAuthGateway();
    const session = createSupabaseSession();

    mockGetSession.mockResolvedValueOnce({ data: { session } });
    await gateway.getSession();

    vi.stubGlobal('navigator', { onLine: false });
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const offlineSession = await gateway.getSession();
    expect(offlineSession?.user.id).toBe('user-1');
  });

  it('keeps session on SIGNED_OUT while offline', () => {
    const gateway = createAuthGateway();
    const received: AuthSession[] = [];

    mockOnAuthStateChange.mockImplementation(
      (handler: (event: AuthChangeEvent, session: Session | null) => void) => {
        handler('SIGNED_IN', createSupabaseSession());
        vi.stubGlobal('navigator', { onLine: false });
        handler('SIGNED_OUT', null);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );

    gateway.onAuthStateChange((session) => {
      if (session) {
        received.push(session);
      }
    });

    expect(received).toHaveLength(2);
    expect(received[1]?.user.id).toBe('user-1');
  });

  it('clears session on SIGNED_OUT while online', () => {
    const gateway = createAuthGateway();
    const received: (AuthSession | null)[] = [];

    vi.stubGlobal('navigator', { onLine: true });

    mockOnAuthStateChange.mockImplementation(
      (handler: (event: AuthChangeEvent, session: Session | null) => void) => {
        handler('SIGNED_IN', createSupabaseSession());
        handler('SIGNED_OUT', null);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );

    gateway.onAuthStateChange((session) => {
      received.push(session);
    });

    expect(received[0]?.user.id).toBe('user-1');
    expect(received[1]).toBeNull();
  });
});
