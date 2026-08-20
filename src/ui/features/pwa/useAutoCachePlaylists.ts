import { useEffect } from 'react';
import { useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useOnlineStatus } from './useOnlineStatus';

export function useAutoCachePlaylists(): void {
  const offline = useOffline();
  const { userId, isOfflineSession } = useAuth();
  const { currentOrg, isLoading, isOfflineData } = useOrg();
  const online = useOnlineStatus();
  const organizationId = currentOrg?.id;

  useEffect(() => {
    if (!online || isOfflineSession || isOfflineData || isLoading) {
      return;
    }
    if (!userId || !organizationId) {
      return;
    }

    void offline.cacheUserReadingPlaylistsForOffline(organizationId, userId);
  }, [online, isOfflineSession, isOfflineData, isLoading, userId, organizationId, offline]);
}
