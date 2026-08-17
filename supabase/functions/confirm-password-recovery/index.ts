import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, code, newPassword } = await req.json();

    if (!email || !code || !newPassword || typeof newPassword !== 'string') {
      return jsonResponse({ error: 'invalid_request' }, 400);
    }

    if (newPassword.length < 8) {
      return jsonResponse({ error: 'weak_password' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const normalizedEmail = email.toLowerCase().trim();
    const codeHash = await hashCode(String(code).trim());

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!profile) {
      return jsonResponse({ error: 'invalid_code' }, 400);
    }

    const { data: recoveryRow } = await supabase
      .from('password_recovery_codes')
      .select('id, expires_at, used_at')
      .eq('user_id', profile.id)
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!recoveryRow) {
      return jsonResponse({ error: 'invalid_code' }, 400);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });

    if (updateError) {
      return jsonResponse({ error: 'update_failed' }, 500);
    }

    await supabase
      .from('password_recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', recoveryRow.id);

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'server_error' }, 500);
  }
});
