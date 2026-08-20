import { useEffect } from 'react';
import { useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useOnlineStatus } from './useOnlineStatus';

export function useAutoCacheMusicians(): void {
  const offline = useOffline();
  const { userId, isOfflineSession } = useAuth();
  const { currentOrg, isLoading, isOfflineData } = useOrg();
  const online = useOnlineStatus();
  const organizationId = currentOrg?.id;
  const isAdmin =
    currentOrg?.accessRole === 'admin' || currentOrg?.accessRole === 'owner';

  useEffect(() => {
    if (!online || isOfflineSession || isOfflineData || isLoading || !isAdmin) {
      return;
    }
    if (!userId || !organizationId) {
      return;
    }

    void offline.cacheMusiciansForOffline(organizationId, userId);
  }, [
    online,
    isOfflineSession,
    isOfflineData,
    isLoading,
    isAdmin,
    userId,
    organizationId,
    offline,
  ]);
}
