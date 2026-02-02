/**
 * @rootlodge/reality-server - HTTP Handlers
 * 
 * HTTP endpoint handlers for Reality server.
 * Framework-agnostic implementation.
 */

import { z } from 'zod';
import type {
  RealityStorage,
  RealityRequest,
  RealityResponse,
  SyncRequest,
  SyncResponse,
  ChangedNode,
  InvalidationResponse,
  HealthResponse,
} from '../types';
import { SyncRequestSchema, InvalidationRequestSchema } from '../types';
import { MeshCoordinator } from '../mesh/coordinator';
import { RedisAccelerator } from '../redis/accelerator';

/**
 * Handler dependencies
 */
export interface HandlerDeps {
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
 * Create JSON response
 */
function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): RealityResponse {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: data,
  };
}

/**
 * Create error response
 */
function errorResponse(message: string, status = 400): RealityResponse {
  return jsonResponse({ error: message }, status);
}

/**
 * Handle sync request
 * 
 * This is the core endpoint that clients call to synchronize state.
 */
export async function handleSync(
  req: RealityRequest,
  deps: HandlerDeps
): Promise<RealityResponse> {
  // Parse and validate request
  const parsed = SyncRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`);
  }

  const syncRequest: SyncRequest = parsed.data;
  const { storage, mesh, redis: _redis, payloadFetcher } = deps;

  try {
    // Get all keys client is interested in
    const keys = Object.keys(syncRequest.known);
    
    // Fetch current metadata for all keys
    const nodeMetas = await storage.getNodes(keys);
    
    // Build changed map
    const changed: Record<string, ChangedNode> = {};
    
    for (const [key, clientVersion] of Object.entries(syncRequest.known)) {
      const meta = nodeMetas.get(key);
      
      if (!meta) {
        // Key doesn't exist on server - could be deleted or never existed
        // We report it as version 0 so client knows it's gone
        changed[key] = {
          version: 0,
          hash: '',
          source: deps.serverId,
        };
        continue;
      }

      // Check if client has different version (newer OR older)
      // This handles both updates and server resets (where client > server)
      if (meta.version !== clientVersion) {
        const changedNode: ChangedNode = {
          version: meta.version,
          hash: meta.hash,
          source: deps.serverId,
        };

        // Include payload for small updates if fetcher is available
        if (payloadFetcher) {
          try {
            const payload = await payloadFetcher(key);
            // Only include if payload is small enough
            const payloadStr = JSON.stringify(payload);
            if (payloadStr.length < 1024) {
              changedNode.payload = payload;
            }
          } catch {
            // Payload fetch failed - client will need to fetch separately
          }
        }

        changed[key] = changedNode;
      }
    }

    // Update mesh max version
    const maxVersion = await storage.getMaxVersion();
    mesh.updateMaxVersion(maxVersion);

    // Build response
    const response: SyncResponse = {
      changed,
      mesh: {
        peers: mesh.getPeerHealthMap(),
        serverVersion: maxVersion,
      },
      serverTime: Date.now(),
    };

    // Create response with gossip header
    const gossipHeader = JSON.stringify(mesh.createGossipPayload());

    return jsonResponse(response, 200, {
      'X-Reality-Gossip': gossipHeader,
      'X-Reality-Server': deps.serverId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}

/**
 * Handle invalidation request
 * 
 * Called when data is updated to propagate invalidation to the mesh.
 */
export async function handleInvalidation(
  req: RealityRequest,
  deps: HandlerDeps
): Promise<RealityResponse> {
  const parsed = InvalidationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`);
  }

  const { keys, source } = parsed.data;
  const { storage, mesh, redis } = deps;

  try {
    const versions: Record<string, number> = {};
    const invalidated: string[] = [];

    // For each key, check if we need to sync from source
    for (const key of keys) {
      const meta = await storage.getNode(key);
      if (meta) {
        versions[key] = meta.version;
        invalidated.push(key);
      }
    }

    // Invalidate Redis cache if available
    if (redis?.isConnected()) {
      for (const key of keys) {
        await redis.invalidateCache(key);
      }
      
      // Publish to other servers
      await redis.publishInvalidation(keys);
    }

    // Propagate to mesh peers (fire and forget)
    if (source !== deps.serverId) {
      mesh.propagateInvalidation(keys);
    }

    const response: InvalidationResponse = {
      invalidated,
      versions,
    };

    return jsonResponse(response, 200, {
      'X-Reality-Gossip': JSON.stringify(mesh.createGossipPayload()),
      'X-Reality-Server': deps.serverId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}

/**
 * Handle version query
 * 
 * Returns all versions changed since a given version.
 * Used for peer-to-peer sync.
 */
export async function handleVersionQuery(
  req: RealityRequest,
  deps: HandlerDeps
): Promise<RealityResponse> {
  const since = parseInt(req.query.since ?? '0', 10);
  
  if (isNaN(since) || since < 0) {
    return errorResponse('Invalid since parameter');
  }

  try {
    const changed = await deps.storage.listChangedSince(since);
    
    return jsonResponse({
      ...deps.mesh.createGossipPayload(),
      changed: changed.map((meta) => ({
        key: meta.key,
        version: meta.version,
        hash: meta.hash,
      })),
    }, 200, {
      'X-Reality-Server': deps.serverId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}

/**
 * Handle health check
 */
export async function handleHealth(
  _req: RealityRequest,
  deps: HandlerDeps
): Promise<RealityResponse> {
  const { storage, mesh, redis, serverId, version, startTime } = deps;

  try {
    const storageHealthy = await storage.isHealthy();
    const maxVersion = await storage.getMaxVersion();
    const meshStats = mesh.getStats();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!storageHealthy) {
      status = 'unhealthy';
    } else if (meshStats.healthyPeerCount === 0 && meshStats.peerCount > 0) {
      status = 'degraded';
    }

    const response: HealthResponse = {
      status,
      serverId,
      version,
      uptime: Date.now() - startTime,
      mesh: {
        peerCount: meshStats.peerCount,
        healthyPeers: meshStats.healthyPeerCount,
      },
      storage: {
        healthy: storageHealthy,
        maxVersion,
      },
    };

    if (redis) {
      response.redis = {
        connected: redis.isConnected(),
      };
    }

    return jsonResponse(response, status === 'unhealthy' ? 503 : 200);
  } catch (error) {
    return jsonResponse({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 503);
  }
}

/**
 * Handle node update (write)
 * 
 * Called when data is written to update the invalidation graph.
 */
export async function handleNodeUpdate(
  req: RealityRequest,
  deps: HandlerDeps
): Promise<RealityResponse> {
  const schema = z.object({
    key: z.string().min(1),
    hash: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`);
  }

  const { key, hash } = parsed.data;
  const { storage, mesh, redis } = deps;

  try {
    // Increment version in storage
    const meta = await storage.incrementVersion(key, hash);

    // Update mesh max version
    mesh.updateMaxVersion(meta.version);

    // Invalidate and propagate
    if (redis?.isConnected()) {
      await redis.invalidateCache(key);
      await redis.publishInvalidation([key]);
    }

    // Propagate to peers
    mesh.propagateInvalidation([key]);

    return jsonResponse({
      key: meta.key,
      version: meta.version,
      hash: meta.hash,
      updatedAt: meta.updatedAt,
    }, 200, {
      'X-Reality-Gossip': JSON.stringify(mesh.createGossipPayload()),
      'X-Reality-Server': deps.serverId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}

/**
 * Handle CORS preflight
 */
export function handleCors(
  _req: RealityRequest,
  origins: string[]
): RealityResponse {
  const allowOrigin = origins.includes('*') ? '*' : origins[0] ?? '*';
  
  return {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Reality-Server, X-Reality-Gossip',
      'Access-Control-Max-Age': '86400',
    },
    body: null,
  };
}
