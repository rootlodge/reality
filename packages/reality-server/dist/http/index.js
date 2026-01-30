'use strict';

var zod = require('zod');

// src/http/handlers.ts
var RealityModeSchema = zod.z.enum(["native", "sse-compat", "polling-compat"]);
var SyncHintSchema = zod.z.enum(["interaction", "focus", "idle", "mutation", "mount", "reconnect"]);
zod.z.object({
  key: zod.z.string(),
  version: zod.z.number().int().nonnegative(),
  hash: zod.z.string(),
  updatedAt: zod.z.number().int()
});
var PeerHealthSchema = zod.z.enum(["healthy", "degraded", "unhealthy", "unknown"]);
zod.z.object({
  peer: zod.z.string().url(),
  maxVersionSeen: zod.z.number().int().nonnegative(),
  lastSeen: zod.z.number().int(),
  health: PeerHealthSchema.optional()
});
var SyncRequestSchema = zod.z.object({
  known: zod.z.record(zod.z.string(), zod.z.number().int().nonnegative()),
  clientId: zod.z.string().uuid(),
  mode: RealityModeSchema,
  hint: SyncHintSchema,
  timestamp: zod.z.number().int().optional()
});
var ChangedNodeSchema = zod.z.object({
  version: zod.z.number().int().nonnegative(),
  hash: zod.z.string(),
  source: zod.z.string().optional(),
  payload: zod.z.unknown().optional()
});
var MeshInfoSchema = zod.z.object({
  peers: zod.z.record(zod.z.string(), PeerHealthSchema),
  serverVersion: zod.z.number().int().nonnegative().optional()
});
zod.z.object({
  changed: zod.z.record(zod.z.string(), ChangedNodeSchema),
  mesh: MeshInfoSchema,
  serverTime: zod.z.number().int()
});
var RealityPersistenceModeSchema = zod.z.enum(["none", "advisory", "external"]);
var RealityExecutionModeSchema = zod.z.enum(["client", "ssr-embedded", "server-external", "auto"]);
zod.z.object({
  /** Server identifier (unique across mesh) */
  serverId: zod.z.string().min(1),
  /** HTTP port to listen on */
  port: zod.z.number().int().positive().default(3e3),
  /** Host to bind to */
  host: zod.z.string().default("0.0.0.0"),
  /** Peer server URLs for mesh */
  peers: zod.z.array(zod.z.string().url()).default([]),
  /** CORS configuration */
  cors: zod.z.object({
    origins: zod.z.array(zod.z.string()).default(["*"]),
    credentials: zod.z.boolean().default(true)
  }).default({}),
  /** Rate limiting */
  rateLimit: zod.z.object({
    enabled: zod.z.boolean().default(false),
    maxRequests: zod.z.number().int().positive().default(100),
    windowMs: zod.z.number().int().positive().default(6e4)
  }).default({}),
  /** Enable debug logging */
  debug: zod.z.boolean().default(false),
  /** Storage configuration */
  storage: zod.z.object({
    type: zod.z.enum(["memory", "drizzle", "prisma", "sql", "dynamodb", "redis", "custom"]).default("memory"),
    connectionString: zod.z.string().optional(),
    tableName: zod.z.string().default("reality_nodes")
  }).default({}),
  /** Redis configuration (optional acceleration) */
  redis: zod.z.object({
    enabled: zod.z.boolean().default(false),
    url: zod.z.string().optional(),
    prefix: zod.z.string().default("reality:")
  }).default({}),
  /** Payload fetcher base URL */
  payloadBaseUrl: zod.z.string().url().optional(),
  /** Execution mode */
  executionMode: RealityExecutionModeSchema.default("server-external"),
  /** Invalidation configuration (optional) */
  invalidation: zod.z.object({
    mode: RealityPersistenceModeSchema.default("none")
  }).default({})
});
zod.z.object({
  serverId: zod.z.string(),
  maxVersion: zod.z.number().int().nonnegative(),
  peerSummaries: zod.z.array(zod.z.object({
    url: zod.z.string().url(),
    health: zod.z.enum(["healthy", "degraded", "unhealthy", "unknown"]),
    maxVersion: zod.z.number().int().nonnegative(),
    lastSeen: zod.z.number().int()
  })),
  timestamp: zod.z.number().int()
});
var InvalidationRequestSchema = zod.z.object({
  keys: zod.z.array(zod.z.string()).min(1),
  source: zod.z.string().optional(),
  timestamp: zod.z.number().int().optional()
});

// src/http/handlers.ts
function jsonResponse(data, status = 200, headers = {}) {
  return {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: data
  };
}
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}
async function handleSync(req, deps) {
  const parsed = SyncRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`);
  }
  const syncRequest = parsed.data;
  const { storage, mesh, redis: _redis, payloadFetcher } = deps;
  try {
    const keys = Object.keys(syncRequest.known);
    const nodeMetas = await storage.getNodes(keys);
    const changed = {};
    for (const [key, clientVersion] of Object.entries(syncRequest.known)) {
      const meta = nodeMetas.get(key);
      if (!meta) {
        changed[key] = {
          version: 0,
          hash: "",
          source: deps.serverId
        };
        continue;
      }
      if (meta.version > clientVersion) {
        const changedNode = {
          version: meta.version,
          hash: meta.hash,
          source: deps.serverId
        };
        if (payloadFetcher) {
          try {
            const payload = await payloadFetcher(key);
            const payloadStr = JSON.stringify(payload);
            if (payloadStr.length < 1024) {
              changedNode.payload = payload;
            }
          } catch {
          }
        }
        changed[key] = changedNode;
      }
    }
    const maxVersion = await storage.getMaxVersion();
    mesh.updateMaxVersion(maxVersion);
    const response = {
      changed,
      mesh: {
        peers: mesh.getPeerHealthMap(),
        serverVersion: maxVersion
      },
      serverTime: Date.now()
    };
    const gossipHeader = JSON.stringify(mesh.createGossipPayload());
    return jsonResponse(response, 200, {
      "X-Reality-Gossip": gossipHeader,
      "X-Reality-Server": deps.serverId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
async function handleInvalidation(req, deps) {
  const parsed = InvalidationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`);
  }
  const { keys, source } = parsed.data;
  const { storage, mesh, redis } = deps;
  try {
    const versions = {};
    const invalidated = [];
    for (const key of keys) {
      const meta = await storage.getNode(key);
      if (meta) {
        versions[key] = meta.version;
        invalidated.push(key);
      }
    }
    if (redis?.isConnected()) {
      for (const key of keys) {
        await redis.invalidateCache(key);
      }
      await redis.publishInvalidation(keys);
    }
    if (source !== deps.serverId) {
      mesh.propagateInvalidation(keys);
    }
    const response = {
      invalidated,
      versions
    };
    return jsonResponse(response, 200, {
      "X-Reality-Gossip": JSON.stringify(mesh.createGossipPayload()),
      "X-Reality-Server": deps.serverId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
async function handleVersionQuery(req, deps) {
  const since = parseInt(req.query.since ?? "0", 10);
  if (isNaN(since) || since < 0) {
    return errorResponse("Invalid since parameter");
  }
  try {
    const changed = await deps.storage.listChangedSince(since);
    return jsonResponse({
      ...deps.mesh.createGossipPayload(),
      changed: changed.map((meta) => ({
        key: meta.key,
        version: meta.version,
        hash: meta.hash
      }))
    }, 200, {
      "X-Reality-Server": deps.serverId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
async function handleHealth(_req, deps) {
  const { storage, mesh, redis, serverId, version, startTime } = deps;
  try {
    const storageHealthy = await storage.isHealthy();
    const maxVersion = await storage.getMaxVersion();
    const meshStats = mesh.getStats();
    let status = "healthy";
    if (!storageHealthy) {
      status = "unhealthy";
    } else if (meshStats.healthyPeerCount === 0 && meshStats.peerCount > 0) {
      status = "degraded";
    }
    const response = {
      status,
      serverId,
      version,
      uptime: Date.now() - startTime,
      mesh: {
        peerCount: meshStats.peerCount,
        healthyPeers: meshStats.healthyPeerCount
      },
      storage: {
        healthy: storageHealthy,
        maxVersion
      }
    };
    if (redis) {
      response.redis = {
        connected: redis.isConnected()
      };
    }
    return jsonResponse(response, status === "unhealthy" ? 503 : 200);
  } catch (error) {
    return jsonResponse({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 503);
  }
}
async function handleNodeUpdate(req, deps) {
  const schema = zod.z.object({
    key: zod.z.string().min(1),
    hash: zod.z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`);
  }
  const { key, hash } = parsed.data;
  const { storage, mesh, redis } = deps;
  try {
    const meta = await storage.incrementVersion(key, hash);
    mesh.updateMaxVersion(meta.version);
    if (redis?.isConnected()) {
      await redis.invalidateCache(key);
      await redis.publishInvalidation([key]);
    }
    mesh.propagateInvalidation([key]);
    return jsonResponse({
      key: meta.key,
      version: meta.version,
      hash: meta.hash,
      updatedAt: meta.updatedAt
    }, 200, {
      "X-Reality-Gossip": JSON.stringify(mesh.createGossipPayload()),
      "X-Reality-Server": deps.serverId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
function handleCors(_req, origins) {
  const allowOrigin = origins.includes("*") ? "*" : origins[0] ?? "*";
  return {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Reality-Server, X-Reality-Gossip",
      "Access-Control-Max-Age": "86400"
    },
    body: null
  };
}

// src/http/express.ts
function toRealityRequest(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value[0] ?? "" : value);
    }
  }
  const query = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (value) {
      query[key] = Array.isArray(value) ? value[0] ?? "" : value;
    }
  }
  return {
    method: req.method,
    url: req.originalUrl,
    headers,
    body: req.body,
    params: req.params,
    query
  };
}
function createExpressMiddleware(deps) {
  return async (req, res, next) => {
    const realityReq = toRealityRequest(req);
    if (req.method === "OPTIONS") {
      const corsResponse = handleCors(realityReq, ["*"]);
      res.status(corsResponse.status).set(corsResponse.headers).end();
      return;
    }
    let response;
    try {
      switch (req.path) {
        case "/sync":
          if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
          }
          response = await handleSync(realityReq, deps);
          break;
        case "/invalidate":
          if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
          }
          response = await handleInvalidation(realityReq, deps);
          break;
        case "/versions":
          if (req.method !== "GET") {
            res.status(405).json({ error: "Method not allowed" });
            return;
          }
          response = await handleVersionQuery(realityReq, deps);
          break;
        case "/health":
          response = await handleHealth(realityReq, deps);
          break;
        case "/update":
          if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
          }
          response = await handleNodeUpdate(realityReq, deps);
          break;
        default:
          next();
          return;
      }
      res.status(response.status).set(response.headers).json(response.body);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error"
      });
    }
  };
}
function createExpressRouter(deps) {
  const routes = [
    {
      method: "options",
      path: "*",
      handler: async (req, res) => {
        const response = handleCors(toRealityRequest(req), ["*"]);
        res.status(response.status).set(response.headers).end();
      }
    },
    {
      method: "post",
      path: "/sync",
      handler: async (req, res) => {
        const response = await handleSync(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    },
    {
      method: "post",
      path: "/invalidate",
      handler: async (req, res) => {
        const response = await handleInvalidation(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    },
    {
      method: "get",
      path: "/versions",
      handler: async (req, res) => {
        const response = await handleVersionQuery(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    },
    {
      method: "get",
      path: "/health",
      handler: async (req, res) => {
        const response = await handleHealth(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    },
    {
      method: "post",
      path: "/update",
      handler: async (req, res) => {
        const response = await handleNodeUpdate(toRealityRequest(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    }
  ];
  return { routes };
}

// src/http/fetch.ts
async function toRealityRequest2(request) {
  const url = new URL(request.url);
  let body = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }
  const query = {};
  for (const [key, value] of url.searchParams) {
    query[key] = value;
  }
  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    body,
    params: {},
    query
  };
}
function toFetchResponse(realityResponse) {
  const body = realityResponse.body !== null ? JSON.stringify(realityResponse.body) : null;
  return new Response(body, {
    status: realityResponse.status,
    headers: realityResponse.headers
  });
}
function createFetchHandler(deps, config = {}) {
  const basePath = config.basePath ?? "/reality";
  const corsOrigins = config.corsOrigins ?? ["*"];
  return async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith(basePath)) {
      return new Response("Not Found", { status: 404 });
    }
    const routePath = path.slice(basePath.length) || "/";
    if (request.method === "OPTIONS") {
      const realityReq = await toRealityRequest2(request);
      const response = handleCors(realityReq, corsOrigins);
      return toFetchResponse(response);
    }
    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigins.includes("*") ? "*" : corsOrigins[0] ?? "*",
      "Access-Control-Allow-Credentials": "true"
    };
    try {
      const realityReq = await toRealityRequest2(request);
      let response;
      switch (routePath) {
        case "/sync":
          if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), {
              status: 405,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
          response = await handleSync(realityReq, deps);
          break;
        case "/invalidate":
          if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), {
              status: 405,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
          response = await handleInvalidation(realityReq, deps);
          break;
        case "/versions":
          if (request.method !== "GET") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), {
              status: 405,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
          response = await handleVersionQuery(realityReq, deps);
          break;
        case "/health":
        case "/":
          response = await handleHealth(realityReq, deps);
          break;
        case "/update":
          if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), {
              status: 405,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
          response = await handleNodeUpdate(realityReq, deps);
          break;
        default:
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
      }
      response.headers = { ...response.headers, ...corsHeaders };
      return toFetchResponse(response);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }
  };
}
function createWorkersHandler(deps, config = {}) {
  const handler = createFetchHandler(deps, config);
  return { fetch: handler };
}

exports.createExpressMiddleware = createExpressMiddleware;
exports.createExpressRouter = createExpressRouter;
exports.createFetchHandler = createFetchHandler;
exports.createWorkersHandler = createWorkersHandler;
exports.handleCors = handleCors;
exports.handleHealth = handleHealth;
exports.handleInvalidation = handleInvalidation;
exports.handleNodeUpdate = handleNodeUpdate;
exports.handleSync = handleSync;
exports.handleVersionQuery = handleVersionQuery;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map