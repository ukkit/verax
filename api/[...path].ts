// Vercel Function (Node.js runtime, fetch web handler): serves /api/* via the shared proxy core.
import { handle } from '../proxy/core';

export default {
  fetch: (request: Request): Promise<Response> => handle(request),
};
