import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { OrganizationWithRole } from '@/application/ports';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useIdentity, useOffline } from '@/ui/app/AppServicesContext';

export const ORG_STORAGE_KEY = 'planner-kairos:current-org-slug';

type OrgContextValue = {
  organizations: OrganizationWithRole[];
  currentOrg: OrganizationWithRole | null;
  isLoading: boolean;
  isOfflineData: boolean;
  setCurrentOrgBySlug: (slug: string) => Promise<boolean>;
  refreshOrganizations: () => Promise<void>;
  resolveOrgBySlug: (slug: string) => OrganizationWithRole | null;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { userId, session } = useAuth();
  const identity = useIdentity();
  const offline = useOffline();
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(
    () => localStorage.getItem(ORG_STORAGE_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);

  const resolveOrgBySlug = useCallback(
    (slug: string) => organizations.find((org) => org.slug === slug) ?? null,
    [organizations],
  );

  const refreshOrganizations = useCallback(async () => {
    if (!userId) {
      setOrganizations([]);
      setIsOfflineData(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (!isBrowserOnline()) {
      const snapshot = await offline.getIdentitySnapshot();
      if (snapshot && snapshot.userId === userId) {
        setOrganizations(snapshot.organizations);
        setIsOfflineData(true);
        setIsLoading(false);
        return;
      }
    }

    const result = await identity.listMyOrganizations(userId);
    if (result.ok) {
      setOrganizations(result.value);
      setIsOfflineData(false);
      if (session) {
        await offline.saveIdentitySnapshot(
          session,
          result.value,
          currentSlug ?? localStorage.getItem(ORG_STORAGE_KEY),
        );
      }
    } else {
      const snapshot = await offline.getIdentitySnapshot();
      if (snapshot && snapshot.userId === userId) {
        setOrganizations(snapshot.organizations);
        setIsOfflineData(true);
      }
    }
    setIsLoading(false);
  }, [identity, userId, session, offline, currentSlug]);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const currentOrg = useMemo(() => {
    if (!currentSlug) {
      return null;
    }
    return organizations.find((o) => o.slug === currentSlug) ?? null;
  }, [organizations, currentSlug]);

  const setCurrentOrgBySlug = useCallback(
    async (slug: string) => {
      if (!userId) {
        return false;
      }

      if (!isBrowserOnline()) {
        const match = organizations.find((org) => org.slug === slug);
        if (!match) {
          return false;
        }
        setCurrentSlug(slug);
        localStorage.setItem(ORG_STORAGE_KEY, slug);
        if (session) {
          await offline.saveIdentitySnapshot(session, organizations, slug);
        }
        return true;
      }

      const result = await identity.setCurrentOrganization(userId, slug);
      if (!result.ok) {
        return false;
      }

      setCurrentSlug(slug);
      localStorage.setItem(ORG_STORAGE_KEY, slug);
      if (session) {
        await offline.saveIdentitySnapshot(session, organizations, slug);
      }
      return true;
    },
    [identity, userId, organizations, session, offline],
  );

  const value = useMemo(
    () => ({
      organizations,
      currentOrg,
      isLoading,
      isOfflineData,
      setCurrentOrgBySlug,
      refreshOrganizations,
      resolveOrgBySlug,
    }),
    [
      organizations,
      currentOrg,
      isLoading,
      isOfflineData,
      setCurrentOrgBySlug,
      refreshOrganizations,
      resolveOrgBySlug,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error('useOrg must be used within OrgProvider');
  }
  return ctx;
}
