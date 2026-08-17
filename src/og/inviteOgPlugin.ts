import type { Plugin } from 'vite';
import path from 'node:path';
import { createInviteOgMiddleware } from './inviteOgMiddleware';

export function inviteOgPlugin(env: Record<string, string>): Plugin {
  const supabaseUrl = env.VITE_SUPABASE_URL ?? '';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY ?? '';
  const appUrl = env.VITE_APP_URL;

  return {
    name: 'invite-og',
    configureServer(server) {
      if (!supabaseUrl || !supabaseAnonKey) {
        return;
      }

      server.middlewares.use(
        createInviteOgMiddleware({
          supabaseUrl,
          supabaseAnonKey,
          appUrl,
          mode: 'development',
        }),
      );
    },
    configurePreviewServer(server) {
      if (!supabaseUrl || !supabaseAnonKey) {
        return;
      }

      server.middlewares.use(
        createInviteOgMiddleware({
          supabaseUrl,
          supabaseAnonKey,
          appUrl,
          mode: 'production',
          distDir: path.resolve('dist'),
        }),
      );
    },
  };
}
