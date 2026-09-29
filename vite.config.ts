import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { handle } from './proxy/core.ts';
import { logError } from './proxy/log.ts';

/** In dev and `vite preview`, serve /api/* with the same proxy core the hosts use, so there is no CORS setup to differ. */
function navProxy(): Plugin {
  const install = (server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      handle(new Request(new URL(req.url, 'http://localhost'), { method: req.method }))
        .then(async (response) => {
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        })
        .catch((error) => {
          logError('dev_proxy_failed', { path: req.url.split('?')[0], error });
          res.statusCode = 500;
          res.end('The dev proxy failed unexpectedly. See the terminal running `npm run dev` for details.');
        });
    });
  };
  return { name: 'nav-proxy', configureServer: install, configurePreviewServer: install };
}

export default defineConfig({
  plugins: [preact(), navProxy()],
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['proxy/**/*.test.ts', 'src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
