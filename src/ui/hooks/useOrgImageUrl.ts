import { useEffect, useState } from 'react';
import { useOffline } from '@/ui/app/AppServicesContext';

export function useOrgImageUrl(storageKey: string | null | undefined): string | null {
  const offline = useOffline();
  const [imageUrl, setImageUrl] = useState<string | null>(() =>
    storageKey ? offline.getCachedOrgImageObjectUrl(storageKey) : null,
  );

  useEffect(() => {
    if (!storageKey) {
      setImageUrl(null);
      return;
    }

    const cached = offline.getCachedOrgImageObjectUrl(storageKey);
    if (cached) {
      setImageUrl(cached);
      return;
    }

    let active = true;
    void offline.resolveOrgImageUrl(storageKey).then((url) => {
      if (active) {
        setImageUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, [offline, storageKey]);

  return imageUrl;
}
