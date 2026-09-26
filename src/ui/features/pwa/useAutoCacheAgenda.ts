import { useEffect } from 'react';
import { offlineAgendaCacheMatchesCurrentRange } from '@/application/offline/agenda-cache-use-cases';
import { useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useOnlineStatus } from './useOnlineStatus';

export function useAutoCacheAgenda(): void {
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

    let cancelled = false;

    async function ensureAgendaCache() {
      const meta = await offline.getCachedAgendaMeta(organizationId!, userId!);
      if (cancelled) {
        return;
      }
      if (
        meta &&
        offlineAgendaCacheMatchesCurrentRange(meta.rangeFrom, meta.rangeTo)
      ) {
        return;
      }

      await offline.cacheAgendaForOffline(organizationId!, userId!);
    }

    void ensureAgendaCache();

    return () => {
      cancelled = true;
    };
  }, [online, isOfflineSession, isOfflineData, isLoading, userId, organizationId, offline]);
}
