import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const loadGenerationRef = useRef(0);

  const resolveOrgBySlug = useCallback(
    (slug: string) => organizations.find((org) => org.slug === slug) ?? null,
    [organizations],
  );

  const refreshOrganizations = useCallback(async () => {
    if (!userId) {
      loadGenerationRef.current += 1;
      setOrganizations([]);
      setIsOfflineData(false);
      setIsLoading(false);
      return;
    }

    const generation = ++loadGenerationRef.current;
    setIsLoading(true);

    if (!isBrowserOnline()) {
      const snapshot = await offline.getIdentitySnapshot();
      if (generation !== loadGenerationRef.current) {
        return;
      }
      if (snapshot && snapshot.userId === userId) {
        setOrganizations(snapshot.organizations);
        setIsOfflineData(true);
        setIsLoading(false);
        return;
      }
    }

    const result = await identity.listMyOrganizations(userId);
    if (generation !== loadGenerationRef.current) {
      return;
    }
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
      if (generation !== loadGenerationRef.current) {
        return;
      }
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

      loadGenerationRef.current += 1;
      setOrganizations((prev) =>
        prev.some((org) => org.id === result.value.id) ? prev : [...prev, result.value],
      );
      setCurrentSlug(slug);
      localStorage.setItem(ORG_STORAGE_KEY, slug);
      setIsLoading(false);

      await refreshOrganizations();
      return true;
    },
    [identity, userId, organizations, session, offline, refreshOrganizations],
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
