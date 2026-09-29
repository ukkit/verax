// Vercel Function (Node.js runtime, fetch web handler): serves /api/* via the shared proxy core. vercel.json rewrites
// every /api/* request here, because Vercel routes a catch-all file only one path segment (see proxy/vercel-path.ts).
import { handle } from '../proxy/core.js';
import { restorePath } from '../proxy/vercel-path.js';

export default {
  fetch: (request: Request): Promise<Response> => handle(restorePath(request)),
};
