import type { ReactNode } from 'react';
import { useAutoCacheAgenda } from '@/ui/features/pwa/useAutoCacheAgenda';
import { useAutoCacheMusicians } from '@/ui/features/pwa/useAutoCacheMusicians';
import { useAutoCachePlaylists } from '@/ui/features/pwa/useAutoCachePlaylists';
import { useOfflineSync } from '@/ui/features/pwa/useOfflineSync';

export function AppBootstrap({ children }: { children: ReactNode }) {
  useOfflineSync();
  useAutoCachePlaylists();
  useAutoCacheAgenda();
  useAutoCacheMusicians();
  return children;
}
