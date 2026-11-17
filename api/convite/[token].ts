import {
  buildInviteOgMeta,
  fetchInvitePreviewRow,
  injectInviteOgIntoHtml,
} from '../../src/og/inviteOg.js';
import { signOrgBrandingUrl } from '../../src/og/signOrgBrandingUrl.js';
import { normalizeEnvUrl } from '../../src/domain/shared/normalizeEnvUrl.js';

type VercelRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => VercelResponse;
  send: (body: string) => void;
  end: () => void;
};

function getSiteOrigin(req: VercelRequest): string {
  if (process.env.VITE_APP_URL) {
    return normalizeEnvUrl(process.env.VITE_APP_URL);
  }

  const host = req.headers?.host;
  const hostValue = Array.isArray(host) ? host[0] : host;
  if (hostValue) {
    const protocol = hostValue.includes('localhost') || hostValue.startsWith('127.') ? 'http' : 'https';
    return `${protocol}://${hostValue}`;
  }

  return 'https://planner.d9digital.com';
}

async function fetchIndexHtml(siteOrigin: string): Promise<string | null> {
  const response = await fetch(`${siteOrigin}/index.html`);
  if (!response.ok) {
    return null;
  }

  return response.text();
}

async function sendIndexHtml(req: VercelRequest, res: VercelResponse, siteOrigin: string): Promise<void> {
  const indexHtml = await fetchIndexHtml(siteOrigin);
  if (!indexHtml) {
    res.status(500).send('Unable to load app shell');
    return;
  }

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.send(indexHtml);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).end();
    return;
  }

  const rawToken = req.query.token;
  const token = typeof rawToken === 'string' ? rawToken : rawToken?.[0];
  if (!token) {
    res.status(400).send('Missing token');
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
    ? normalizeEnvUrl(process.env.VITE_SUPABASE_URL)
    : undefined;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
    ? normalizeEnvUrl(process.env.VITE_SUPABASE_ANON_KEY)
    : undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send('Server configuration error');
    return;
  }

  const siteOrigin = getSiteOrigin(req);

  try {
    const preview = await fetchInvitePreviewRow(token, supabaseUrl, supabaseAnonKey);
    if (!preview) {
      await sendIndexHtml(req, res, siteOrigin);
      return;
    }

    const indexHtml = await fetchIndexHtml(siteOrigin);
    if (!indexHtml) {
      res.status(500).send('Unable to load app shell');
      return;
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const signedImageUrl =
      preview.organization_image_storage_key && serviceRoleKey
        ? await signOrgBrandingUrl({
            supabaseUrl,
            serviceRoleKey,
            organizationId: preview.organization_id,
            storageKey: preview.organization_image_storage_key,
          })
        : null;

    const html = injectInviteOgIntoHtml(
      indexHtml,
      buildInviteOgMeta(preview, { token, siteOrigin }, signedImageUrl),
    );

    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    res.send(html);
  } catch (error) {
    console.error('convite OG handler failed:', error);
    await sendIndexHtml(req, res, siteOrigin);
  }
}
