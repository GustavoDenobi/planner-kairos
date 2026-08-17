import { useEffect, useState } from 'react';
import type { UserProfile } from '@/domain/identity';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';

export function useUserProfile(): UserProfile | null {
  const { userId } = useAuth();
  const identity = useIdentity();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    let active = true;
    identity.getProfile(userId).then((result) => {
      if (active) {
        setProfile(result);
      }
    });

    return () => {
      active = false;
    };
  }, [userId, identity]);

  return profile;
}
