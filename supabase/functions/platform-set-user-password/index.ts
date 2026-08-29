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

async function requirePlatformAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { error: jsonResponse({ error: 'not_authenticated' }, 401) };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: isAdmin, error: adminError } = await userClient.rpc('is_platform_admin');
  if (adminError || !isAdmin) {
    return { error: jsonResponse({ error: 'forbidden' }, 403) };
  }

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: jsonResponse({ error: 'not_authenticated' }, 401) };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { adminClient, actorUserId: userData.user.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const auth = await requirePlatformAdmin(req);
    if ('error' in auth && auth.error) {
      return auth.error;
    }

    const { adminClient, actorUserId } = auth;
    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword || typeof newPassword !== 'string') {
      return jsonResponse({ error: 'invalid_request' }, 400);
    }

    if (newPassword.length < 8) {
      return jsonResponse({ error: 'weak_password' }, 400);
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    await adminClient.from('platform_audit_log').insert({
      actor_user_id: actorUserId,
      action: 'set_user_password',
      target_type: 'user',
      target_id: userId,
      metadata: {},
    });

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'internal_error' }, 500);
  }
});
