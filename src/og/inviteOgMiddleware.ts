import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect } from 'vite';
import { buildInviteOgHtml, parseProductionAssets } from '../og/inviteOg';

type InviteOgMiddlewareOptions = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl?: string;
  mode: 'development' | 'production';
  distDir?: string;
};

function getSiteOrigin(req: IncomingMessage, appUrl?: string): string {
  if (appUrl) {
    return appUrl.replace(/\/$/, '');
  }

  const host = req.headers.host ?? 'localhost:5173';
  const protocol = host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export function createInviteOgMiddleware(options: InviteOgMiddlewareOptions): Connect.NextHandleFunction {
  let productionAssets: { js: string; css?: string } | undefined;

  if (options.mode === 'production' && options.distDir) {
    const indexPath = path.join(options.distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      productionAssets = parseProductionAssets(fs.readFileSync(indexPath, 'utf-8'));
    }
  }

  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const requestUrl = req.url ?? '';
    const match = requestUrl.match(/^\/convite\/([^/?#]+)/);
    if (!match) {
      next();
      return;
    }

    const token = decodeURIComponent(match[1]);
    const siteOrigin = getSiteOrigin(req, options.appUrl);

    try {
      const html = await buildInviteOgHtml({
        token,
        siteOrigin,
        supabaseUrl: options.supabaseUrl,
        supabaseAnonKey: options.supabaseAnonKey,
        mode: options.mode,
        productionAssets,
      });

      if (!html) {
        next();
        return;
      }

      if (req.method === 'HEAD') {
        (res as ServerResponse).statusCode = 200;
        (res as ServerResponse).setHeader('Content-Type', 'text/html; charset=utf-8');
        (res as ServerResponse).end();
        return;
      }

      (res as ServerResponse).statusCode = 200;
      (res as ServerResponse).setHeader('Content-Type', 'text/html; charset=utf-8');
      (res as ServerResponse).end(html);
    } catch (error) {
      console.error('invite OG middleware failed:', error);
      next();
    }
  };
}
