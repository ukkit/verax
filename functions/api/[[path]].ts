// Cloudflare Pages Function: serves /api/* by delegating to the shared proxy core, behind Cloudflare's Cache API.
import { cached, type EdgeCache } from '../../proxy/edge-cache';
import { handle } from '../../proxy/core';

interface Context {
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
}

export const onRequest = ({ request, waitUntil }: Context): Promise<Response> =>
  cached(request, (caches as unknown as { default: EdgeCache }).default, waitUntil, handle);
