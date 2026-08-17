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
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useIdentity } from '@/ui/app/AppServicesContext';

const ORG_STORAGE_KEY = 'planner-kairos:current-org-slug';

type OrgContextValue = {
  organizations: OrganizationWithRole[];
  currentOrg: OrganizationWithRole | null;
  isLoading: boolean;
  setCurrentOrgBySlug: (slug: string) => Promise<boolean>;
  refreshOrganizations: () => Promise<void>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const identity = useIdentity();
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(
    () => localStorage.getItem(ORG_STORAGE_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);

  const refreshOrganizations = useCallback(async () => {
    if (!userId) {
      setOrganizations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const result = await identity.listMyOrganizations(userId);
    if (result.ok) {
      setOrganizations(result.value);
    }
    setIsLoading(false);
  }, [identity, userId]);

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

      const result = await identity.setCurrentOrganization(userId, slug);
      if (!result.ok) {
        return false;
      }

      setCurrentSlug(slug);
      localStorage.setItem(ORG_STORAGE_KEY, slug);
      return true;
    },
    [identity, userId],
  );

  const value = useMemo(
    () => ({
      organizations,
      currentOrg,
      isLoading,
      setCurrentOrgBySlug,
      refreshOrganizations,
    }),
    [organizations, currentOrg, isLoading, setCurrentOrgBySlug, refreshOrganizations],
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
