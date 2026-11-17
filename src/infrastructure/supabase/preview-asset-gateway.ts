import type { PreviewAssetGateway } from '@/application/ports/preview-asset-gateway';
import { supabase } from './client';

export function createPreviewAssetGateway(): PreviewAssetGateway {
  return {
    async signBranding(purpose, token, storageKey) {
      const { data, error } = await supabase.functions.invoke('sign-preview-asset', {
        body: { purpose, token, storageKey },
      });

      if (error || !data || typeof data !== 'object' || !('signedUrl' in data)) {
        return null;
      }

      const signedUrl = (data as { signedUrl: unknown }).signedUrl;
      return typeof signedUrl === 'string' && signedUrl ? signedUrl : null;
    },
  };
}
