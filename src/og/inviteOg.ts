import { publicOrgImageUrl } from '../ui/utils/publicOrgImageUrl';

export type InvitePreviewRow = {
  invite_id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  organization_image_storage_key: string | null;
  group_id: string;
  group_name: string;
  expires_at: string;
};

export type InviteOgHtmlOptions = {
  token: string;
  siteOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  mode: 'development' | 'production';
  productionAssets?: { js: string; css?: string };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function fetchInvitePreviewRow(
  token: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<InvitePreviewRow | null> {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_invite_preview`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: token }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as InvitePreviewRow[];
  return data[0] ?? null;
}

export async function buildInviteOgHtml(options: InviteOgHtmlOptions): Promise<string | null> {
  const preview = await fetchInvitePreviewRow(
    options.token,
    options.supabaseUrl,
    options.supabaseAnonKey,
  );

  if (!preview) {
    return null;
  }

  const pageUrl = `${options.siteOrigin.replace(/\/$/, '')}/convite/${encodeURIComponent(options.token)}`;
  const title = `Convite — ${preview.organization_name}`;
  const description = `Participe de ${preview.organization_name} no grupo ${preview.group_name}.`;
  const imageUrl = preview.organization_image_storage_key
    ? publicOrgImageUrl(options.supabaseUrl, preview.organization_image_storage_key)
    : null;

  const imageTags = imageUrl
    ? [
        `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
        `<meta property="og:image:alt" content="${escapeHtml(preview.organization_name)}" />`,
        `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
      ].join('\n    ')
    : '';

  const cssTag = options.productionAssets?.css
    ? `<link rel="stylesheet" crossorigin href="${escapeHtml(options.productionAssets.css)}" />`
    : '';

  const scripts =
    options.mode === 'development'
      ? `<script type="module" src="/@vite/client"></script>
    <script type="module" src="/src/main.tsx"></script>`
      : `<script type="module" crossorigin src="${escapeHtml(options.productionAssets?.js ?? '/assets/index.js')}"></script>`;

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Planner Kairós" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:locale" content="pt_BR" />
    ${imageTags}
    <meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    ${cssTag}
    ${scripts}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

export function parseProductionAssets(indexHtml: string): { js: string; css?: string } | undefined {
  const jsMatch = indexHtml.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!jsMatch) {
    return undefined;
  }

  const cssMatch = indexHtml.match(/href="(\/assets\/index-[^"]+\.css)"/);
  return { js: jsMatch[1], css: cssMatch?.[1] };
}
