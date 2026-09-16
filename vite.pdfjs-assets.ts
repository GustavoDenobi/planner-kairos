import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';

const PDFJS_PUBLIC_PREFIX = '/pdfjs';
const WASM_PUBLIC_PREFIX = `${PDFJS_PUBLIC_PREFIX}/wasm`;
const WORKER_PUBLIC_PATH = `${PDFJS_PUBLIC_PREFIX}/pdf.worker.min.mjs`;

function pdfjsPackageRoot(): string {
  return path.resolve(process.cwd(), 'node_modules/pdfjs-dist');
}

function wasmDir(): string {
  return path.join(pdfjsPackageRoot(), 'wasm');
}

function workerFile(): string {
  return path.join(pdfjsPackageRoot(), 'build/pdf.worker.min.mjs');
}

function contentTypeFor(fileName: string): string {
  if (fileName.endsWith('.wasm')) {
    return 'application/wasm';
  }
  if (fileName.endsWith('.mjs') || fileName.endsWith('.js')) {
    return 'text/javascript';
  }
  return 'text/plain';
}

function sendFile(filePath: string, res: ServerResponse, next: Connect.NextFunction): void {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    next();
    return;
  }

  res.setHeader('Content-Type', contentTypeFor(path.basename(filePath)));
  createReadStream(filePath).pipe(res);
}

function serveWasmDirectory(): Connect.NextHandleFunction {
  return (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const requestPath = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
    const fileName = path.basename(requestPath);
    if (!fileName || fileName !== path.normalize(fileName)) {
      next();
      return;
    }

    sendFile(path.join(wasmDir(), fileName), res, next);
  };
}

function serveWorkerFile(): Connect.NextHandleFunction {
  return (_req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    sendFile(workerFile(), res, next);
  };
}

function attachDevRoutes(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use(WASM_PUBLIC_PREFIX, serveWasmDirectory());
  server.middlewares.use(WORKER_PUBLIC_PATH, serveWorkerFile());
}

export function pdfjsAssetsPlugin(): Plugin {
  return {
    name: 'pdfjs-assets',
    configureServer: attachDevRoutes,
    configurePreviewServer: attachDevRoutes,
    generateBundle() {
      const workerPath = workerFile();
      if (existsSync(workerPath)) {
        this.emitFile({
          type: 'asset',
          fileName: WORKER_PUBLIC_PATH.slice(1),
          source: readFileSync(workerPath),
        });
      }

      const wasmRoot = wasmDir();
      if (!existsSync(wasmRoot)) {
        return;
      }

      for (const fileName of readdirSync(wasmRoot)) {
        const filePath = path.join(wasmRoot, fileName);
        if (!statSync(filePath).isFile()) {
          continue;
        }
        this.emitFile({
          type: 'asset',
          fileName: `${WASM_PUBLIC_PREFIX.slice(1)}/${fileName}`,
          source: readFileSync(filePath),
        });
      }
    },
  };
}
