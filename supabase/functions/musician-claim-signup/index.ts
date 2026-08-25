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

async function findUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) {
      return null;
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) {
      return match;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function ensureProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  displayName: string,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    return;
  }

  await supabase.from('profiles').insert({
    id: userId,
    display_name: displayName,
    email,
    theme: 'light',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { musicianId, email, password, displayName } = await req.json();

    if (
      !musicianId ||
      !email ||
      !password ||
      !displayName ||
      typeof musicianId !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof displayName !== 'string' ||
      password.length < 6
    ) {
      return jsonResponse({ error: 'invalid_request' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: preview, error: previewError } = await supabase.rpc('get_musician_claim_preview', {
      p_musician_id: musicianId,
    });

    if (previewError || !preview || preview.length === 0) {
      return jsonResponse({ error: 'not_found' }, 400);
    }

    if (preview[0].already_claimed) {
      return jsonResponse({ error: 'already_claimed' }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const trimmedDisplayName = displayName.trim();

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: trimmedDisplayName },
    });

    if (!createError && created.user) {
      await ensureProfile(supabase, created.user.id, normalizedEmail, trimmedDisplayName);
      return jsonResponse({ ok: true });
    }

    const existingUser = await findUserByEmail(supabase, normalizedEmail);
    if (!existingUser) {
      return jsonResponse({ error: 'signup_failed' }, 400);
    }

    if (existingUser.email_confirmed_at) {
      return jsonResponse({ error: 'email_taken' }, 400);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: trimmedDisplayName },
    });

    if (updateError) {
      return jsonResponse({ error: 'signup_failed' }, 400);
    }

    await ensureProfile(supabase, existingUser.id, normalizedEmail, trimmedDisplayName);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'server_error' }, 500);
  }
});
