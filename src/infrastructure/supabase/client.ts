import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!url || !anonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Tipado com Database após gerar tipos: createClient<Database>(url, anonKey)
export const supabase = createClient(url, anonKey, {
  storage: {
    // Direct storage host — required for reliable uploads (esp. PDFs > ~6 MB).
    useNewHostname: true,
  },
});
