import type { FileStorage } from '@/application/ports';
import { supabase } from './client';

const BRANDING_BUCKET = 'org-assets';

export function createFileStorage(): FileStorage {
  return {
    async uploadBranding(organizationId, file) {
      const fileId = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${organizationId}/branding/${fileId}-${safeName}`;

      const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

      if (error) {
        throw new Error(error.message);
      }

      return path;
    },

    async uploadPieceFile(organizationId, pieceId, fileId, file, contentType) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${organizationId}/pieces/${pieceId}/${fileId}-${safeName}`;

      const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
        upsert: false,
        contentType,
      });

      if (error) {
        throw new Error(error.message);
      }

      return path;
    },

    async remove(path) {
      const { error } = await supabase.storage.from(BRANDING_BUCKET).remove([path]);
      if (error) {
        throw new Error(error.message);
      }
    },

    async getSignedUrl(path, expiresInSeconds = 3600) {
      const { data, error } = await supabase.storage
        .from(BRANDING_BUCKET)
        .createSignedUrl(path, expiresInSeconds);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? 'signed_url_failed');
      }

      return data.signedUrl;
    },
  };
}
