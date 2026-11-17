import { useEffect, useState } from 'react';
import type { PreviewAssetPurpose } from '@/application/ports/preview-asset-gateway';
import { useIdentity } from '@/ui/app/AppServicesContext';

export function usePreviewBrandingUrl(
  purpose: PreviewAssetPurpose,
  token: string | undefined,
  storageKey: string | null | undefined,
): string | null {
  const identity = useIdentity();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !storageKey) {
      setImageUrl(null);
      return;
    }

    let active = true;
    void identity.signPreviewBranding(purpose, token, storageKey).then((signedUrl) => {
      if (active) {
        setImageUrl(signedUrl);
      }
    });

    return () => {
      active = false;
    };
  }, [identity, purpose, token, storageKey]);

  return imageUrl;
}
