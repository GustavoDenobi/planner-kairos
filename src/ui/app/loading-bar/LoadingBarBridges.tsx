import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { useOrg } from '@/ui/app/OrgProvider';

export function LoadingBarAuthBridge() {
  const { isLoading } = useAuth();
  useLoadingBar('auth', isLoading);
  return null;
}

export function LoadingBarOrgBridge() {
  const { isLoading } = useOrg();
  useLoadingBar('org', isLoading);
  return null;
}
