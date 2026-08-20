import type { ReactNode } from 'react';
import { useAutoCachePlaylists } from '@/ui/features/pwa/useAutoCachePlaylists';
import { useOfflineSync } from '@/ui/features/pwa/useOfflineSync';

export function AppBootstrap({ children }: { children: ReactNode }) {
  useOfflineSync();
  useAutoCachePlaylists();
  return children;
}
