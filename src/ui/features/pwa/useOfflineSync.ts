import { useEffect } from 'react';
import { useOffline } from '@/ui/app/AppServicesContext';
import { useOnlineStatus } from './useOnlineStatus';

export function useOfflineSync(): void {
  const offline = useOffline();
  const online = useOnlineStatus();

  useEffect(() => {
    if (online) {
      void offline.syncPendingOfflineChanges();
    }
  }, [online, offline]);

  useEffect(() => {
    void offline.syncPendingOfflineChanges();
  }, [offline]);
}
