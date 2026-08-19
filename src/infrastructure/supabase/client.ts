import { createClient } from '@supabase/supabase-js';

import { normalizeEnvUrl } from '@/domain/shared';

const url = normalizeEnvUrl(import.meta.env.VITE_SUPABASE_URL ?? '');
const anonKey = normalizeEnvUrl(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '');

if (!url || !anonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Tipado com Database após gerar tipos: createClient<Database>(url, anonKey)
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  storage: {
    // Direct storage host — required for reliable uploads (esp. PDFs > ~6 MB).
    useNewHostname: true,
  },
});
