import type { ReactNode } from 'react';
import { useOfflineSync } from '@/ui/features/pwa/useOfflineSync';

export function AppBootstrap({ children }: { children: ReactNode }) {
  useOfflineSync();
  return children;
}
