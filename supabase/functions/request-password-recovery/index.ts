import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import nodemailer from 'npm:nodemailer@6.9.16';

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

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmail(to: string, subject: string, text: string) {
  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT') ?? '587'),
    secure: Deno.env.get('SMTP_SECURE') === 'true',
    auth: {
      user: Deno.env.get('SMTP_USER'),
      pass: Deno.env.get('SMTP_PASSWORD'),
    },
  });

  await transport.sendMail({
    from: Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER'),
    to,
    subject,
    text,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return jsonResponse({ ok: true });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const normalizedEmail = email.toLowerCase().trim();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profile) {
      await supabase
        .from('password_recovery_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', profile.id)
        .is('used_at', null);

      const code = generateOtp();
      const codeHash = await hashCode(code);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await supabase.from('password_recovery_codes').insert({
        user_id: profile.id,
        email: profile.email,
        code_hash: codeHash,
        expires_at: expiresAt.toISOString(),
      });

      await sendEmail(
        profile.email,
        'Código de recuperação — Planner Kairós',
        `Seu código de recuperação de senha é: ${code}\n\nVálido por 15 minutos.`,
      );
    }

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ ok: true });
  }
});
