// Local server: serves the built site from dist/ and /api/* through the shared proxy core.
// Binds to localhost by default. There is deliberately no login gate: it is meant for your own machine.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../proxy/core';
import { logError } from '../proxy/log';
import { ASSET_CACHE_CONTROL, SECURITY_HEADERS } from '../proxy/security';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8787);
const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function applyHeaders(res: ServerResponse): void {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
}

async function serveApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const response = await handle(new Request(url, { method: req.method }));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const isMissing = (error: unknown) => error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');

/** A missing file is an expected answer (null); any other failure, such as a permission error, propagates. */
async function fileIfExists(path: string): Promise<string | null> {
  try {
    return (await stat(path)).isFile() ? path : null;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET, HEAD');
    res.end();
    return;
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.statusCode = 400;
    res.end('Malformed URL path: it contains an invalid percent-encoding.');
    return;
  }
  const candidate = resolve(join(ROOT, pathname));
  const inRoot = candidate === ROOT || candidate.startsWith(ROOT + sep);
  // Unknown non-asset paths fall back to the SPA entry point.
  const file = (inRoot ? await fileIfExists(candidate) : null) ?? (extname(pathname) ? null : await fileIfExists(join(ROOT, 'index.html')));
  if (!file) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
  res.setHeader('cache-control', file.includes(`${sep}assets${sep}`) ? ASSET_CACHE_CONTROL : 'no-cache');
  res.statusCode = 200;
  res.end(req.method === 'HEAD' ? undefined : await readFile(file));
}

const server = createServer((req, res) => {
  applyHeaders(res);
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const task = url.pathname.startsWith('/api/') ? serveApi(req, res, url) : serveStatic(req, res, url);
  task.catch((error) => {
    logError('request_failed', { method: req.method, path: url.pathname, error });
    if (!res.headersSent) res.statusCode = 500;
    res.end('Internal error while handling this request. See the server log for details.');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} on http://${HOST}:${PORT}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
    console.warn('HOST is not loopback and there is no login gate. Only expose this on a network you trust.');
  }
});
