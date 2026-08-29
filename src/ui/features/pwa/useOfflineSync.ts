import { useEffect } from 'react';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOffline } from '@/ui/app/AppServicesContext';
import { useOnlineStatus } from './useOnlineStatus';

export function useOfflineSync(): void {
  const offline = useOffline();
  const online = useOnlineStatus();
  const { userId } = useAuth();

  useEffect(() => {
    if (online && userId) {
      void offline.syncPendingOfflineChanges(userId);
    }
  }, [online, offline, userId]);

  useEffect(() => {
    if (userId) {
      void offline.syncPendingOfflineChanges(userId);
    }
  }, [offline, userId]);
}
