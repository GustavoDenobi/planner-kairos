import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { isOrgBrandingStorageKey } from '../_shared/branding.ts';
import { clientIp, consumeRateLimit, sha256Hex } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type PreviewRow = {
  organization_id: string;
  organization_image_storage_key: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { purpose, token, storageKey } = await req.json();

    if (
      (purpose !== 'invite' && purpose !== 'claim') ||
      typeof token !== 'string' ||
      typeof storageKey !== 'string' ||
      !token ||
      !storageKey
    ) {
      return jsonResponse({ error: 'invalid_request' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const allowed = await consumeRateLimit(
      supabase,
      'sign_preview_asset',
      await sha256Hex(clientIp(req)),
      60,
      15 * 60,
    );
    if (!allowed) {
      return jsonResponse({ error: 'rate_limited' }, 429);
    }

    const rpcName = purpose === 'invite' ? 'get_invite_preview' : 'get_musician_claim_preview';
    const { data, error } = await supabase.rpc(rpcName, { p_token: token });
    const preview = (Array.isArray(data) ? data[0] : null) as PreviewRow | undefined;

    if (error || !preview) {
      return jsonResponse({ error: 'not_found' }, 404);
    }

    if (preview.organization_image_storage_key !== storageKey) {
      return jsonResponse({ error: 'forbidden' }, 403);
    }

    if (!isOrgBrandingStorageKey(preview.organization_id, storageKey)) {
      return jsonResponse({ error: 'forbidden' }, 403);
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('org-assets')
      .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      return jsonResponse({ error: 'sign_failed' }, 500);
    }

    return jsonResponse({ signedUrl: signed.signedUrl });
  } catch {
    return jsonResponse({ error: 'server_error' }, 500);
  }
});
