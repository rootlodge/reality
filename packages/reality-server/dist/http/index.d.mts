import { R as RealityStorage, z as RealityRequest, A as RealityResponse } from '../index-DMEqceRR.mjs';
import { MeshCoordinator } from '../mesh/index.mjs';
import { RedisAccelerator } from '../redis/index.mjs';
import 'zod';

/**
 * @rootlodge/reality-server - HTTP Handlers
 *
 * HTTP endpoint handlers for Reality server.
 * Framework-agnostic implementation.
 */

/**
 * Handler dependencies
 */
interface HandlerDeps {
    storage: RealityStorage;
    mesh: MeshCoordinator;
    redis?: RedisAccelerator;
    serverId: string;
    version: string;
    startTime: number;
    debug?: boolean;
    /** Optional: Fetch payload for a key */
    payloadFetcher?: (key: string) => Promise<unknown>;
}
/**
 * Handle sync request
 *
 * This is the core endpoint that clients call to synchronize state.
 */
declare function handleSync(req: RealityRequest, deps: HandlerDeps): Promise<RealityResponse>;
/**
 * Handle invalidation request
 *
 * Called when data is updated to propagate invalidation to the mesh.
 */
declare function handleInvalidation(req: RealityRequest, deps: HandlerDeps): Promise<RealityResponse>;
/**
 * Handle version query
 *
 * Returns all versions changed since a given version.
 * Used for peer-to-peer sync.
 */
declare function handleVersionQuery(req: RealityRequest, deps: HandlerDeps): Promise<RealityResponse>;
/**
 * Handle health check
 */
declare function handleHealth(_req: RealityRequest, deps: HandlerDeps): Promise<RealityResponse>;
/**
 * Handle node update (write)
 *
 * Called when data is written to update the invalidation graph.
 */
declare function handleNodeUpdate(req: RealityRequest, deps: HandlerDeps): Promise<RealityResponse>;
/**
 * Handle CORS preflight
 */
declare function handleCors(_req: RealityRequest, origins: string[]): RealityResponse;

/**
 * @rootlodge/reality-server - Express Adapter
 *
 * Adapter for Express.js framework.
 */

/**
 * Express-compatible request
 */
interface ExpressRequest {
    method: string;
    url: string;
    originalUrl: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    params: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
}
/**
 * Express-compatible response
 */
interface ExpressResponse {
    status(code: number): ExpressResponse;
    set(headers: Record<string, string>): ExpressResponse;
    json(data: unknown): void;
    send(data: unknown): void;
    end(): void;
}
/**
 * Express middleware type
 */
type ExpressMiddleware = (req: ExpressRequest, res: ExpressResponse, next: () => void) => void | Promise<void>;
/**
 * Create Express middleware for Reality server
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createExpressMiddleware } from '@rootlodge/reality-server/http';
 *
 * const app = express();
 * app.use(express.json());
 *
 * const realityMiddleware = createExpressMiddleware({
 *   storage,
 *   mesh,
 *   serverId: 'server-1',
 *   version: '1.0.0',
 *   startTime: Date.now(),
 * });
 *
 * app.use('/reality', realityMiddleware);
 * ```
 */
declare function createExpressMiddleware(deps: HandlerDeps): ExpressMiddleware;
/**
 * Create Express router with all Reality routes
 *
 * For use with app.use() when you want Reality at a specific path prefix.
 */
declare function createExpressRouter(deps: HandlerDeps): {
    routes: {
        method: "get" | "post" | "options";
        path: string;
        handler: (req: ExpressRequest, res: ExpressResponse) => Promise<void>;
    }[];
};

/**
 * @rootlodge/reality-server - Fetch API Handler
 *
 * Universal handler using the Fetch API standard.
 * Works with Cloudflare Workers, Deno, Bun, Node.js 18+, and any edge runtime.
 */

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
declare function createFetchHandler(deps: HandlerDeps, config?: RouteConfig): (request: Request) => Promise<Response>;
/**
 * Create a Cloudflare Workers compatible handler
 */
declare function createWorkersHandler(deps: HandlerDeps, config?: RouteConfig): {
    fetch: (request: Request) => Promise<Response>;
};

export { type HandlerDeps, createExpressMiddleware, createExpressRouter, createFetchHandler, createWorkersHandler, handleCors, handleHealth, handleInvalidation, handleNodeUpdate, handleSync, handleVersionQuery };
