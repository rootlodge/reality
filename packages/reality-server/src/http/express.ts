/**
 * @rootlodge/reality-server - Express Adapter
 * 
 * Adapter for Express.js framework.
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
type ExpressMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: () => void
) => void | Promise<void>;

/**
 * Convert Express request to Reality request
 */
function toRealityRequest(req: ExpressRequest): RealityRequest {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value[0] ?? '' : value);
    }
  }

  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (value) {
      query[key] = Array.isArray(value) ? value[0] ?? '' : value;
    }
  }

  return {
    method: req.method,
    url: req.originalUrl,
    headers,
    body: req.body,
    params: req.params,
    query,
  };
}

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
export function createExpressMiddleware(deps: HandlerDeps): ExpressMiddleware {
  return async (req: ExpressRequest, res: ExpressResponse, next: () => void) => {
    const realityReq = toRealityRequest(req);
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      const corsResponse = handleCors(realityReq, ['*']);
      res.status(corsResponse.status).set(corsResponse.headers).end();
      return;
    }

    // Route to appropriate handler
    let response;
    
    try {
      switch (req.path) {
        case '/sync':
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          response = await handleSync(realityReq, deps);
          break;

        case '/invalidate':
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          response = await handleInvalidation(realityReq, deps);
          break;

        case '/versions':
          if (req.method !== 'GET') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          response = await handleVersionQuery(realityReq, deps);
          break;

        case '/health':
          response = await handleHealth(realityReq, deps);
          break;

        case '/update':
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          response = await handleNodeUpdate(realityReq, deps);
          break;

        default:
          // Not a Reality route, pass to next middleware
          next();
          return;
      }

      // Send response
      res.status(response.status).set(response.headers).json(response.body);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  };
}

/**
 * Create Express router with all Reality routes
 * 
 * For use with app.use() when you want Reality at a specific path prefix.
 */
export function createExpressRouter(deps: HandlerDeps) {
  // Return an object that can be used with minimal Express-like setup
  const routes: Array<{
    method: 'get' | 'post' | 'options';
    path: string;
    handler: (req: ExpressRequest, res: ExpressResponse) => Promise<void>;
  }> = [
    {
      method: 'options',
      path: '*',
      handler: async (req, res) => {
        const response = handleCors(toRealityRequest(req), ['*']);
        res.status(response.status).set(response.headers).end();
      },
    },
    {
      method: 'post',
      path: '/sync',
      handler: async (req, res) => {
        const response = await handleSync(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      },
    },
    {
      method: 'post',
      path: '/invalidate',
      handler: async (req, res) => {
        const response = await handleInvalidation(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      },
    },
    {
      method: 'get',
      path: '/versions',
      handler: async (req, res) => {
        const response = await handleVersionQuery(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      },
    },
    {
      method: 'get',
      path: '/health',
      handler: async (req, res) => {
        const response = await handleHealth(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      },
    },
    {
      method: 'post',
      path: '/update',
      handler: async (req, res) => {
        const response = await handleNodeUpdate(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      },
    },
  ];

  return { routes };
}
