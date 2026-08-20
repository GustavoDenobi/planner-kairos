import type { Location } from 'react-router-dom';

export type ReturnToState = {
  returnTo?: string;
};

export function locationPath(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function readReturnTo(state: unknown): string | undefined {
  const value = (state as ReturnToState | null)?.returnTo;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function withReturnTo<T extends Record<string, unknown>>(
  state: T,
  returnTo: string,
): T & ReturnToState {
  return { ...state, returnTo };
}
