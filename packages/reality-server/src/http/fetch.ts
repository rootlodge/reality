/**
 * @rootlodge/reality-server - Fetch API Handler
 * 
 * Universal handler using the Fetch API standard.
 * Works with Cloudflare Workers, Deno, Bun, Node.js 18+, and any edge runtime.
 */

import type { RealityRequest } from '../types';
import type { HandlerDeps } from './handlers';
import {
  handleSync,
  handleInvalidation,
  handleVersionQuery,
  handleHealth,
  handleNodeUpdate,
  handleCors,
} from './handlers';

/**
 * Route configuration
 */
interface RouteConfig {
  /** Base path for Reality routes (e.g., '/reality') */
  basePath?: string;
  /** CORS origins */
  corsOrigins?: string[];
}

/**
 * Convert Fetch Request to Reality request
 */
async function toRealityRequest(request: Request): Promise<RealityRequest> {
  const url = new URL(request.url);
  
  let body: unknown = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }

  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    query[key] = value;
  }

  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    body,
    params: {},
    query,
  };
}

/**
 * Convert Reality response to Fetch Response
 */
function toFetchResponse(realityResponse: { status: number; headers: Record<string, string>; body: unknown }): Response {
  const body = realityResponse.body !== null
    ? JSON.stringify(realityResponse.body)
    : null;

  return new Response(body, {
    status: realityResponse.status,
    headers: realityResponse.headers,
  });
}

/**
 * Create a Fetch API handler for Reality server
 * 
 * This is the universal handler that works with any runtime supporting Fetch API.
 * 
 * @example
 * ```typescript
 * // Cloudflare Workers
 * import { createFetchHandler } from '@rootlodge/reality-server/http';
 * 
 * const handler = createFetchHandler(deps, { basePath: '/reality' });
 * 
 * export default {
 *   fetch: handler,
 * };
 * ```
 * 
 * @example
 * ```typescript
 * // Deno
 * import { createFetchHandler } from '@rootlodge/reality-server/http';
 * 
 * const handler = createFetchHandler(deps, { basePath: '/reality' });
 * 
 * Deno.serve({ port: 3000 }, handler);
 * ```
 * 
 * @example
 * ```typescript
 * // Bun
 * import { createFetchHandler } from '@rootlodge/reality-server/http';
 * 
 * const handler = createFetchHandler(deps, { basePath: '/reality' });
 * 
 * Bun.serve({ port: 3000, fetch: handler });
 * ```
 * 
 * @example
 * ```typescript
 * // Node.js 18+ with native fetch
 * import { createServer } from 'http';
 * import { createFetchHandler } from '@rootlodge/reality-server/http';
 * 
 * const handler = createFetchHandler(deps, { basePath: '/reality' });
 * 
 * createServer(async (req, res) => {
 *   const url = `http://${req.headers.host}${req.url}`;
 *   const request = new Request(url, {
 *     method: req.method,
 *     headers: req.headers as HeadersInit,
 *     body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
 *   });
 *   const response = await handler(request);
 *   res.writeHead(response.status, Object.fromEntries(response.headers));
 *   res.end(await response.text());
 * }).listen(3000);
 * ```
 */
export function createFetchHandler(
  deps: HandlerDeps,
  config: RouteConfig = {}
): (request: Request) => Promise<Response> {
  const basePath = config.basePath ?? '/reality';
  const corsOrigins = config.corsOrigins ?? ['*'];

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check if this is a Reality route
    if (!path.startsWith(basePath)) {
      return new Response('Not Found', { status: 404 });
    }

    // Get the route path (without base path)
    const routePath = path.slice(basePath.length) || '/';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const realityReq = await toRealityRequest(request);
      const response = handleCors(realityReq, corsOrigins);
      return toFetchResponse(response);
    }

    // Add CORS headers to all responses
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': corsOrigins.includes('*') ? '*' : corsOrigins[0] ?? '*',
      'Access-Control-Allow-Credentials': 'true',
    };

    try {
      const realityReq = await toRealityRequest(request);
      let response;

      switch (routePath) {
        case '/sync':
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          response = await handleSync(realityReq, deps);
          break;

        case '/invalidate':
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          response = await handleInvalidation(realityReq, deps);
          break;

        case '/versions':
          if (request.method !== 'GET') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          response = await handleVersionQuery(realityReq, deps);
          break;

        case '/health':
        case '/':
          response = await handleHealth(realityReq, deps);
          break;

        case '/update':
          if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
              status: 405,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          response = await handleNodeUpdate(realityReq, deps);
          break;

        default:
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
      }

      // Merge CORS headers
      response.headers = { ...response.headers, ...corsHeaders };
      return toFetchResponse(response);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  };
}

/**
 * Create a Cloudflare Workers compatible handler
 */
export function createWorkersHandler(
  deps: HandlerDeps,
  config: RouteConfig = {}
): { fetch: (request: Request) => Promise<Response> } {
  const handler = createFetchHandler(deps, config);
  return { fetch: handler };
}
