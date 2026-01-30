import { z } from 'zod';

// src/types/index.ts
var RealityModeSchema = z.enum(["native", "sse-compat", "polling-compat"]);
var SyncHintSchema = z.enum(["interaction", "focus", "idle", "mutation", "mount", "reconnect"]);
var RealityNodeMetaSchema = z.object({
  key: z.string(),
  version: z.number().int().nonnegative(),
  hash: z.string(),
  updatedAt: z.number().int()
});
var PeerHealthSchema = z.enum(["healthy", "degraded", "unhealthy", "unknown"]);
var PeerSummarySchema = z.object({
  peer: z.string().url(),
  maxVersionSeen: z.number().int().nonnegative(),
  lastSeen: z.number().int(),
  health: PeerHealthSchema.optional()
});
var SyncRequestSchema = z.object({
  known: z.record(z.string(), z.number().int().nonnegative()),
  clientId: z.string().uuid(),
  mode: RealityModeSchema,
  hint: SyncHintSchema,
  timestamp: z.number().int().optional()
});
var ChangedNodeSchema = z.object({
  version: z.number().int().nonnegative(),
  hash: z.string(),
  source: z.string().optional(),
  payload: z.unknown().optional()
});
var MeshInfoSchema = z.object({
  peers: z.record(z.string(), PeerHealthSchema),
  serverVersion: z.number().int().nonnegative().optional()
});
var SyncResponseSchema = z.object({
  changed: z.record(z.string(), ChangedNodeSchema),
  mesh: MeshInfoSchema,
  serverTime: z.number().int()
});
var RealityPersistenceModeSchema = z.enum(["none", "advisory", "external"]);
var RealityExecutionModeSchema = z.enum(["client", "ssr-embedded", "server-external", "auto"]);
var ServerConfigSchema = z.object({
  /** Server identifier (unique across mesh) */
  serverId: z.string().min(1),
  /** HTTP port to listen on */
  port: z.number().int().positive().default(3e3),
  /** Host to bind to */
  host: z.string().default("0.0.0.0"),
  /** Peer server URLs for mesh */
  peers: z.array(z.string().url()).default([]),
  /** CORS configuration */
  cors: z.object({
    origins: z.array(z.string()).default(["*"]),
    credentials: z.boolean().default(true)
  }).default({}),
  /** Rate limiting */
  rateLimit: z.object({
    enabled: z.boolean().default(false),
    maxRequests: z.number().int().positive().default(100),
    windowMs: z.number().int().positive().default(6e4)
  }).default({}),
  /** Enable debug logging */
  debug: z.boolean().default(false),
  /** Storage configuration */
  storage: z.object({
    type: z.enum(["memory", "drizzle", "prisma", "sql", "dynamodb", "redis", "custom"]).default("memory"),
    connectionString: z.string().optional(),
    tableName: z.string().default("reality_nodes")
  }).default({}),
  /** Redis configuration (optional acceleration) */
  redis: z.object({
    enabled: z.boolean().default(false),
    url: z.string().optional(),
    prefix: z.string().default("reality:")
  }).default({}),
  /** Payload fetcher base URL */
  payloadBaseUrl: z.string().url().optional(),
  /** Execution mode */
  executionMode: RealityExecutionModeSchema.default("server-external"),
  /** Invalidation configuration (optional) */
  invalidation: z.object({
    mode: RealityPersistenceModeSchema.default("none")
  }).default({})
});
var GossipPayloadSchema = z.object({
  serverId: z.string(),
  maxVersion: z.number().int().nonnegative(),
  peerSummaries: z.array(z.object({
    url: z.string().url(),
    health: z.enum(["healthy", "degraded", "unhealthy", "unknown"]),
    maxVersion: z.number().int().nonnegative(),
    lastSeen: z.number().int()
  })),
  timestamp: z.number().int()
});
var InvalidationRequestSchema = z.object({
  keys: z.array(z.string()).min(1),
  source: z.string().optional(),
  timestamp: z.number().int().optional()
});

// src/storage/memory.ts
var MemoryStorage = class {
  constructor() {
    this.nodes = /* @__PURE__ */ new Map();
    this.maxVersion = 0;
  }
  async getNode(key) {
    return this.nodes.get(key) ?? null;
  }
  async setNode(meta) {
    this.nodes.set(meta.key, meta);
    this.maxVersion = Math.max(this.maxVersion, meta.version);
  }
  async incrementVersion(key, hash) {
    const version = this.maxVersion + 1;
    const meta = {
      key,
      version,
      hash,
      updatedAt: Date.now()
    };
    this.nodes.set(key, meta);
    this.maxVersion = version;
    return meta;
  }
  async listChangedSince(version) {
    const result = [];
    for (const meta of this.nodes.values()) {
      if (meta.version > version) {
        result.push(meta);
      }
    }
    return result.sort((a, b) => a.version - b.version);
  }
  async getNodes(keys) {
    const result = /* @__PURE__ */ new Map();
    for (const key of keys) {
      const meta = this.nodes.get(key);
      if (meta) {
        result.set(key, meta);
      }
    }
    return result;
  }
  async getMaxVersion() {
    return this.maxVersion;
  }
  async deleteNode(key) {
    this.nodes.delete(key);
  }
  async isHealthy() {
    return true;
  }
  /**
   * Clear all data (useful for testing)
   */
  clear() {
    this.nodes.clear();
    this.maxVersion = 0;
  }
  /**
   * Get all nodes (for debugging)
   */
  getAllNodes() {
    return new Map(this.nodes);
  }
};
function createMemoryStorage() {
  return new MemoryStorage();
}

// src/mesh/coordinator.ts
var MeshCoordinator = class {
  constructor(config) {
    this.config = {
      timeout: 5e3,
      staleThreshold: 6e4,
      debug: false,
      ...config
    };
    this.state = {
      serverId: config.serverId,
      maxVersionSeen: 0,
      peers: /* @__PURE__ */ new Map(),
      lastGossipTime: 0
    };
    for (const url of config.peers) {
      this.state.peers.set(url, {
        url,
        serverId: "",
        // Will be populated on first contact
        health: "unknown",
        maxVersionSeen: 0,
        lastSeen: 0,
        lastLatency: 0
      });
    }
  }
  /**
   * Get current server ID
   */
  getServerId() {
    return this.state.serverId;
  }
  /**
   * Get current max version seen by this server
   */
  getMaxVersionSeen() {
    return this.state.maxVersionSeen;
  }
  /**
   * Update max version seen
   */
  updateMaxVersion(version) {
    this.state.maxVersionSeen = Math.max(this.state.maxVersionSeen, version);
  }
  /**
   * Get peer health map for sync responses
   */
  getPeerHealthMap() {
    const result = {};
    for (const [url, peer] of this.state.peers) {
      result[url] = peer.health;
    }
    return result;
  }
  /**
   * Get all peers
   */
  getPeers() {
    return new Map(this.state.peers);
  }
  /**
   * Get healthy peers sorted by staleness (least stale first)
   */
  getHealthyPeers() {
    const now = Date.now();
    const staleThreshold = this.config.staleThreshold;
    return Array.from(this.state.peers.values()).filter((peer) => {
      if (peer.health === "unhealthy") return false;
      if (now - peer.lastSeen > staleThreshold) return false;
      return true;
    }).sort((a, b) => {
      const versionDiff = b.maxVersionSeen - a.maxVersionSeen;
      if (versionDiff !== 0) return versionDiff;
      return a.lastLatency - b.lastLatency;
    });
  }
  /**
   * Create gossip payload to piggyback on responses
   */
  createGossipPayload() {
    const peerSummaries = Array.from(this.state.peers.values()).map((peer) => ({
      url: peer.url,
      health: peer.health,
      maxVersion: peer.maxVersionSeen,
      lastSeen: peer.lastSeen
    }));
    return {
      serverId: this.state.serverId,
      maxVersion: this.state.maxVersionSeen,
      peerSummaries,
      timestamp: Date.now()
    };
  }
  /**
   * Process incoming gossip from a peer
   */
  processGossip(gossip, sourceUrl, latency) {
    const parsed = GossipPayloadSchema.safeParse(gossip);
    if (!parsed.success) {
      if (this.config.debug) {
        console.warn(`[Mesh] Invalid gossip from ${sourceUrl}:`, parsed.error);
      }
      return;
    }
    const now = Date.now();
    const sourcePeer = this.state.peers.get(sourceUrl);
    if (sourcePeer) {
      sourcePeer.serverId = gossip.serverId;
      sourcePeer.health = "healthy";
      sourcePeer.maxVersionSeen = gossip.maxVersion;
      sourcePeer.lastSeen = now;
      sourcePeer.lastLatency = latency;
    }
    for (const summary of gossip.peerSummaries) {
      if (summary.url === this.getServerUrl()) continue;
      let peer = this.state.peers.get(summary.url);
      if (!peer) {
        peer = {
          url: summary.url,
          serverId: "",
          health: summary.health,
          maxVersionSeen: summary.maxVersion,
          lastSeen: summary.lastSeen,
          lastLatency: 0
        };
        this.state.peers.set(summary.url, peer);
        if (this.config.debug) {
          console.log(`[Mesh] Discovered new peer: ${summary.url}`);
        }
      } else {
        if (summary.lastSeen > peer.lastSeen) {
          peer.health = summary.health;
          peer.maxVersionSeen = Math.max(peer.maxVersionSeen, summary.maxVersion);
        }
      }
    }
    this.state.lastGossipTime = now;
  }
  /**
   * Mark a peer as unhealthy after failed communication
   */
  markPeerUnhealthy(url) {
    const peer = this.state.peers.get(url);
    if (peer) {
      peer.health = "unhealthy";
      if (this.config.debug) {
        console.log(`[Mesh] Marked peer unhealthy: ${url}`);
      }
    }
  }
  /**
   * Propagate invalidation to peers
   * 
   * This is done opportunistically, piggybacking on the next request.
   * It's NOT required for correctness - just acceleration.
   */
  async propagateInvalidation(keys) {
    const healthyPeers = this.getHealthyPeers();
    const targetPeers = healthyPeers.slice(0, Math.ceil(healthyPeers.length / 2));
    const promises = targetPeers.map(async (peer) => {
      try {
        const startTime = Date.now();
        const response = await fetch(`${peer.url}/reality/invalidate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Reality-Server": this.state.serverId
          },
          body: JSON.stringify({
            keys,
            source: this.state.serverId,
            timestamp: Date.now()
          }),
          signal: AbortSignal.timeout(this.config.timeout)
        });
        const latency = Date.now() - startTime;
        if (response.ok) {
          const gossip = response.headers.get("X-Reality-Gossip");
          if (gossip) {
            try {
              this.processGossip(JSON.parse(gossip), peer.url, latency);
            } catch {
            }
          }
        } else {
          this.markPeerUnhealthy(peer.url);
        }
      } catch {
        this.markPeerUnhealthy(peer.url);
      }
    });
    Promise.allSettled(promises);
  }
  /**
   * Query a peer for missing versions
   * 
   * Used when a client reports versions we haven't seen.
   */
  async queryPeerForVersions(sinceVersion) {
    const healthyPeers = this.getHealthyPeers();
    for (const peer of healthyPeers) {
      if (peer.maxVersionSeen <= sinceVersion) continue;
      try {
        const startTime = Date.now();
        const response = await fetch(
          `${peer.url}/reality/versions?since=${sinceVersion}`,
          {
            headers: {
              "X-Reality-Server": this.state.serverId
            },
            signal: AbortSignal.timeout(this.config.timeout)
          }
        );
        const latency = Date.now() - startTime;
        if (response.ok) {
          const gossip = await response.json();
          this.processGossip(gossip, peer.url, latency);
          return gossip;
        }
      } catch {
        this.markPeerUnhealthy(peer.url);
      }
    }
    return null;
  }
  /**
   * Get server URL (for self-identification in gossip)
   */
  getServerUrl() {
    return `http://localhost:${process.env.PORT ?? 3e3}`;
  }
  /**
   * Get mesh statistics
   */
  getStats() {
    const healthyCount = Array.from(this.state.peers.values()).filter((p) => p.health === "healthy").length;
    return {
      serverId: this.state.serverId,
      maxVersionSeen: this.state.maxVersionSeen,
      peerCount: this.state.peers.size,
      healthyPeerCount: healthyCount,
      lastGossipTime: this.state.lastGossipTime
    };
  }
};
function createMeshCoordinator(config) {
  return new MeshCoordinator(config);
}
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
  const schema = z.object({
    key: z.string().min(1),
    hash: z.string().min(1)
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

// src/http/fetch.ts
async function toRealityRequest(request) {
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
      const realityReq = await toRealityRequest(request);
      const response = handleCors(realityReq, corsOrigins);
      return toFetchResponse(response);
    }
    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigins.includes("*") ? "*" : corsOrigins[0] ?? "*",
      "Access-Control-Allow-Credentials": "true"
    };
    try {
      const realityReq = await toRealityRequest(request);
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

// src/server.ts
var RealityServer = class {
  constructor(config, customStorage) {
    const parsed = ServerConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(`Invalid server config: ${parsed.error.message}`);
    }
    const resolvedConfig = parsed.data;
    const storage = customStorage ?? new MemoryStorage();
    const mesh = createMeshCoordinator({
      serverId: resolvedConfig.serverId,
      peers: resolvedConfig.peers,
      debug: resolvedConfig.debug
    });
    this.components = {
      config: resolvedConfig,
      storage,
      mesh,
      startTime: Date.now()
    };
    this.handlerDeps = {
      storage: this.components.storage,
      mesh: this.components.mesh,
      redis: this.components.redis,
      serverId: resolvedConfig.serverId,
      version: "1.0.0",
      startTime: this.components.startTime,
      debug: resolvedConfig.debug
    };
  }
  /**
   * Invalidate a single key
   * Call this when your data changes - Reality will propagate the invalidation.
   * 
   * @param key - The key to invalidate (e.g., 'chat:room:123')
   */
  async invalidate(key) {
    return this.invalidateMany([key]);
  }
  /**
   * Invalidate multiple keys at once
   * More efficient than calling invalidate() multiple times.
   * 
   * @param keys - Array of keys to invalidate
   */
  async invalidateMany(keys) {
    for (const key of keys) {
      await this.components.storage.incrementVersion(key, "");
    }
    const maxVersion = await this.components.storage.getMaxVersion();
    this.components.mesh.updateMaxVersion(maxVersion);
    if (this.components.redis?.isConnected()) {
      for (const key of keys) {
        await this.components.redis.invalidateCache(key);
      }
      await this.components.redis.publishInvalidation(keys);
    }
    this.components.mesh.propagateInvalidation(keys);
    if (this.components.invalidationAdapter) {
      await this.components.invalidationAdapter.onInvalidate(keys);
    }
  }
  /**
   * Set invalidation adapter for database integration
   */
  setInvalidationAdapter(adapter) {
    this.components.invalidationAdapter = adapter;
  }
  /**
   * Set custom storage adapter
   */
  setStorage(storage) {
    this.components.storage = storage;
    this.handlerDeps.storage = storage;
  }
  /**
   * Set Redis accelerator
   */
  setRedis(redis) {
    this.components.redis = redis;
    this.handlerDeps.redis = redis;
  }
  /**
   * Set payload fetcher for inline payloads
   */
  setPayloadFetcher(fetcher) {
    this.handlerDeps.payloadFetcher = fetcher;
  }
  /**
   * Get the Fetch API handler
   */
  getFetchHandler(basePath = "/reality") {
    return createFetchHandler(this.handlerDeps, {
      basePath,
      corsOrigins: this.components.config.cors.origins
    });
  }
  /**
   * Get handler dependencies for custom integrations
   */
  getHandlerDeps() {
    return { ...this.handlerDeps };
  }
  /**
   * Get storage instance
   */
  getStorage() {
    return this.components.storage;
  }
  /**
   * Get mesh coordinator
   */
  getMesh() {
    return this.components.mesh;
  }
  /**
   * Get Redis accelerator if configured
   */
  getRedis() {
    return this.components.redis;
  }
  /**
   * Update a node's version (call this when your data changes)
   * 
   * @param key - The node key
   * @param hash - Hash of the new data
   * @returns Updated node metadata
   */
  async updateNode(key, hash) {
    const meta = await this.components.storage.incrementVersion(key, hash);
    this.components.mesh.updateMaxVersion(meta.version);
    if (this.components.redis?.isConnected()) {
      await this.components.redis.invalidateCache(key);
      await this.components.redis.publishInvalidation([key]);
    }
    this.components.mesh.propagateInvalidation([key]);
    return meta;
  }
  /**
   * Get node metadata
   */
  async getNode(key) {
    return this.components.storage.getNode(key);
  }
  /**
   * Delete a node
   */
  async deleteNode(key) {
    await this.components.storage.deleteNode(key);
    if (this.components.redis?.isConnected()) {
      await this.components.redis.invalidateCache(key);
      await this.components.redis.publishInvalidation([key]);
    }
    this.components.mesh.propagateInvalidation([key]);
  }
  /**
   * Get server statistics
   */
  getStats() {
    return {
      serverId: this.components.config.serverId,
      uptime: Date.now() - this.components.startTime,
      mesh: this.components.mesh.getStats(),
      redis: this.components.redis?.getStats()
    };
  }
};
function createRealityServer(config, storage) {
  return new RealityServer(config, storage);
}

// src/embedded.ts
var EmbeddedRealityServer = class {
  constructor(config = {}) {
    this.config = {
      serverId: config.serverId ?? `embedded-${Date.now().toString(36)}`,
      storage: config.storage ?? new MemoryStorage(),
      invalidation: config.invalidation,
      peers: config.peers ?? [],
      debug: config.debug ?? false
    };
    this.storage = this.config.storage;
    this.invalidationAdapter = config.invalidation?.adapter;
    this.startTime = Date.now();
    this.mesh = createMeshCoordinator({
      serverId: this.config.serverId,
      peers: this.config.peers,
      debug: this.config.debug
    });
  }
  /**
   * Get server ID
   */
  getServerId() {
    return this.config.serverId;
  }
  /**
   * Handle a sync request directly (no HTTP)
   */
  async handleSync(request) {
    const keys = Object.keys(request.known);
    const nodeMetas = await this.storage.getNodes(keys);
    const changed = {};
    for (const [key, clientVersion] of Object.entries(request.known)) {
      const meta = nodeMetas.get(key);
      if (!meta) {
        changed[key] = {
          version: 0,
          hash: "",
          source: this.config.serverId
        };
        continue;
      }
      if (meta.version > clientVersion) {
        changed[key] = {
          version: meta.version,
          hash: meta.hash,
          source: this.config.serverId
        };
      }
    }
    const maxVersion = await this.storage.getMaxVersion();
    return {
      changed,
      mesh: {
        peers: this.mesh.getPeerHealthMap(),
        serverVersion: maxVersion
      },
      serverTime: Date.now()
    };
  }
  /**
   * Invalidate keys
   */
  async invalidate(keys) {
    for (const key of keys) {
      await this.storage.incrementVersion(key, "");
    }
    if (this.invalidationAdapter) {
      await this.invalidationAdapter.onInvalidate(keys);
    }
    const maxVersion = await this.storage.getMaxVersion();
    this.mesh.updateMaxVersion(maxVersion);
  }
  /**
   * Invalidate many keys at once
   */
  async invalidateMany(keys) {
    return this.invalidate(keys);
  }
  /**
   * Get node metadata
   */
  async getNode(key) {
    return this.storage.getNode(key);
  }
  /**
   * Update a node's version
   */
  async updateNode(key, hash) {
    const meta = await this.storage.incrementVersion(key, hash);
    this.mesh.updateMaxVersion(meta.version);
    if (this.invalidationAdapter) {
      await this.invalidationAdapter.onInvalidate([key]);
    }
    return meta;
  }
  /**
   * Get storage instance
   */
  getStorage() {
    return this.storage;
  }
  /**
   * Set storage adapter
   */
  setStorage(storage) {
    this.storage = storage;
    this.config.storage = storage;
  }
  /**
   * Set invalidation adapter
   */
  setInvalidationAdapter(adapter) {
    this.invalidationAdapter = adapter;
  }
  /**
   * Get handler dependencies for custom integrations
   */
  getHandlerDeps() {
    return {
      storage: this.storage,
      mesh: this.mesh,
      serverId: this.config.serverId,
      version: "1.0.0",
      startTime: this.startTime,
      debug: this.config.debug
    };
  }
  /**
   * Get mesh coordinator
   */
  getMesh() {
    return this.mesh;
  }
  /**
   * Get server stats
   */
  getStats() {
    return {
      serverId: this.config.serverId,
      uptime: Date.now() - this.startTime,
      mode: "embedded",
      mesh: this.mesh.getStats()
    };
  }
};
function createEmbeddedRealityServer(config = {}) {
  return new EmbeddedRealityServer(config);
}
var sharedEmbeddedServer = null;
function getSharedEmbeddedServer(config) {
  if (!sharedEmbeddedServer) {
    sharedEmbeddedServer = createEmbeddedRealityServer(config);
  }
  return sharedEmbeddedServer;
}
function resetSharedEmbeddedServer() {
  sharedEmbeddedServer = null;
}

// src/storage/sql/sql-storage.ts
var SQLDialects = {
  postgres: {
    placeholder: (i) => `$${i}`,
    upsert: (table, columns, conflictColumn) => `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (${conflictColumn}) DO UPDATE SET ${columns.filter((c) => c !== conflictColumn).map((c, _i) => `${c} = EXCLUDED.${c}`).join(", ")}`,
    now: () => "NOW()"
  },
  mysql: {
    placeholder: () => "?",
    upsert: (table, columns, conflictColumn) => `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")}) ON DUPLICATE KEY UPDATE ${columns.filter((c) => c !== conflictColumn).map((c) => `${c} = VALUES(${c})`).join(", ")}`,
    now: () => "NOW()"
  },
  sqlite: {
    placeholder: () => "?",
    upsert: (table, columns, _conflictColumn) => `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    now: () => "datetime('now')"
  }
};
var SQLStorage = class {
  constructor(config) {
    this.initialized = false;
    this.executor = config.executor;
    this.dialect = config.dialect;
    this.tableName = config.tableName;
    if (config.autoCreateTable) {
      this.ensureTable();
    }
  }
  /**
   * Ensure the table exists
   */
  async ensureTable() {
    if (this.initialized) return;
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key VARCHAR(255) PRIMARY KEY,
        version BIGINT NOT NULL,
        hash VARCHAR(64) NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `;
    await this.executor.execute(sql);
    const indexSql = `
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_version 
      ON ${this.tableName} (version)
    `;
    try {
      await this.executor.execute(indexSql);
    } catch {
    }
    this.initialized = true;
  }
  async getNode(key) {
    await this.ensureTable();
    const sql = `SELECT key, version, hash, updated_at FROM ${this.tableName} WHERE key = ${this.dialect.placeholder(1)}`;
    const row = await this.executor.executeOne(sql, [key]);
    if (!row) return null;
    return {
      key: row.key,
      version: Number(row.version),
      hash: row.hash,
      updatedAt: Number(row.updated_at)
    };
  }
  async setNode(meta) {
    await this.ensureTable();
    const sql = this.dialect.upsert(
      this.tableName,
      ["key", "version", "hash", "updated_at"],
      "key"
    );
    await this.executor.execute(sql, [meta.key, meta.version, meta.hash, meta.updatedAt]);
  }
  async incrementVersion(key, hash) {
    await this.ensureTable();
    return this.executor.transaction(async (tx) => {
      const maxSql = `SELECT COALESCE(MAX(version), 0) as max_version FROM ${this.tableName}`;
      const maxResult = await tx.executeOne(maxSql);
      const newVersion = (maxResult?.max_version ?? 0) + 1;
      const meta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now()
      };
      const upsertSql = this.dialect.upsert(
        this.tableName,
        ["key", "version", "hash", "updated_at"],
        "key"
      );
      await tx.execute(upsertSql, [meta.key, meta.version, meta.hash, meta.updatedAt]);
      return meta;
    });
  }
  async listChangedSince(version) {
    await this.ensureTable();
    const sql = `
      SELECT key, version, hash, updated_at 
      FROM ${this.tableName} 
      WHERE version > ${this.dialect.placeholder(1)}
      ORDER BY version ASC
    `;
    const rows = await this.executor.execute(sql, [version]);
    return rows.map((row) => ({
      key: row.key,
      version: Number(row.version),
      hash: row.hash,
      updatedAt: Number(row.updated_at)
    }));
  }
  async getNodes(keys) {
    await this.ensureTable();
    if (keys.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const placeholders = keys.map((_, i) => this.dialect.placeholder(i + 1)).join(", ");
    const sql = `
      SELECT key, version, hash, updated_at 
      FROM ${this.tableName} 
      WHERE key IN (${placeholders})
    `;
    const rows = await this.executor.execute(sql, keys);
    const result = /* @__PURE__ */ new Map();
    for (const row of rows) {
      result.set(row.key, {
        key: row.key,
        version: Number(row.version),
        hash: row.hash,
        updatedAt: Number(row.updated_at)
      });
    }
    return result;
  }
  async getMaxVersion() {
    await this.ensureTable();
    const sql = `SELECT COALESCE(MAX(version), 0) as max_version FROM ${this.tableName}`;
    const result = await this.executor.executeOne(sql);
    return result?.max_version ?? 0;
  }
  async deleteNode(key) {
    await this.ensureTable();
    const sql = `DELETE FROM ${this.tableName} WHERE key = ${this.dialect.placeholder(1)}`;
    await this.executor.execute(sql, [key]);
  }
  async isHealthy() {
    try {
      await this.executor.executeOne("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
};
function createSQLStorage(config) {
  return new SQLStorage(config);
}

// src/storage/drizzle/drizzle-storage.ts
var DrizzleStorage = class {
  constructor(config) {
    this.db = config.db;
    this.table = config.table;
    this.ops = config.operators;
  }
  async getNode(key) {
    const results = await this.db.select().from(this.table).where(this.ops.eq(this.table.key, key));
    if (results.length === 0) return null;
    const row = results[0];
    return {
      key: row.key,
      version: row.version,
      hash: row.hash,
      updatedAt: row.updatedAt
    };
  }
  async setNode(meta) {
    await this.db.insert(this.table).values({
      key: meta.key,
      version: meta.version,
      hash: meta.hash,
      updatedAt: meta.updatedAt
    }).onConflictDoUpdate({
      target: this.table.key,
      set: {
        version: meta.version,
        hash: meta.hash,
        updatedAt: meta.updatedAt
      }
    });
  }
  async incrementVersion(key, hash) {
    return this.db.transaction(async (tx) => {
      const maxResults = await tx.select({ maxVersion: this.ops.max(this.table.version) }).from(this.table);
      const maxVersion = maxResults[0]?.maxVersion ?? 0;
      const newVersion = maxVersion + 1;
      const meta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now()
      };
      await tx.insert(this.table).values({
        key: meta.key,
        version: meta.version,
        hash: meta.hash,
        updatedAt: meta.updatedAt
      }).onConflictDoUpdate({
        target: this.table.key,
        set: {
          version: meta.version,
          hash: meta.hash,
          updatedAt: meta.updatedAt
        }
      });
      return meta;
    });
  }
  async listChangedSince(version) {
    const results = await this.db.select().from(this.table).orderBy(this.ops.asc(this.table.version)).where(this.ops.gt(this.table.version, version));
    return results.map((row) => ({
      key: row.key,
      version: row.version,
      hash: row.hash,
      updatedAt: row.updatedAt
    }));
  }
  async getNodes(keys) {
    if (keys.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const results = await this.db.select().from(this.table).where(this.ops.inArray(this.table.key, keys));
    const map = /* @__PURE__ */ new Map();
    for (const row of results) {
      map.set(row.key, {
        key: row.key,
        version: row.version,
        hash: row.hash,
        updatedAt: row.updatedAt
      });
    }
    return map;
  }
  async getMaxVersion() {
    const results = await this.db.select({ maxVersion: this.ops.max(this.table.version) }).from(this.table);
    return results[0]?.maxVersion ?? 0;
  }
  async deleteNode(key) {
    await this.db.delete(this.table).where(this.ops.eq(this.table.key, key));
  }
  async isHealthy() {
    try {
      await this.db.select().from(this.table).where(this.ops.eq(1, 0));
      return true;
    } catch {
      return false;
    }
  }
};
function createDrizzleStorage(config) {
  return new DrizzleStorage(config);
}
var DRIZZLE_POSTGRES_SCHEMA = `
import { pgTable, varchar, bigint, index } from 'drizzle-orm/pg-core';

export const realityNodes = pgTable('reality_nodes', {
  key: varchar('key', { length: 255 }).primaryKey(),
  version: bigint('version', { mode: 'number' }).notNull(),
  hash: varchar('hash', { length: 64 }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (table) => ({
  versionIdx: index('version_idx').on(table.version),
}));
`;
var DRIZZLE_MYSQL_SCHEMA = `
import { mysqlTable, varchar, bigint, index } from 'drizzle-orm/mysql-core';

export const realityNodes = mysqlTable('reality_nodes', {
  key: varchar('key', { length: 255 }).primaryKey(),
  version: bigint('version', { mode: 'number' }).notNull(),
  hash: varchar('hash', { length: 64 }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (table) => ({
  versionIdx: index('version_idx').on(table.version),
}));
`;
var DRIZZLE_SQLITE_SCHEMA = `
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const realityNodes = sqliteTable('reality_nodes', {
  key: text('key').primaryKey(),
  version: integer('version').notNull(),
  hash: text('hash').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  versionIdx: index('version_idx').on(table.version),
}));
`;

// src/storage/prisma/prisma-storage.ts
var PrismaStorage = class {
  constructor(config) {
    this.prisma = config.prisma;
  }
  async getNode(key) {
    const node = await this.prisma.realityNode.findUnique({
      where: { key }
    });
    if (!node) return null;
    return {
      key: node.key,
      version: Number(node.version),
      hash: node.hash,
      updatedAt: Number(node.updatedAt)
    };
  }
  async setNode(meta) {
    await this.prisma.realityNode.upsert({
      where: { key: meta.key },
      create: {
        key: meta.key,
        version: BigInt(meta.version),
        hash: meta.hash,
        updatedAt: BigInt(meta.updatedAt)
      },
      update: {
        key: meta.key,
        version: BigInt(meta.version),
        hash: meta.hash,
        updatedAt: BigInt(meta.updatedAt)
      }
    });
  }
  async incrementVersion(key, hash) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.realityNode.aggregate({
        _max: { version: true }
      });
      const maxVersion = result._max.version ?? BigInt(0);
      const newVersion = Number(maxVersion) + 1;
      const meta = {
        key,
        version: newVersion,
        hash,
        updatedAt: Date.now()
      };
      await tx.realityNode.upsert({
        where: { key },
        create: {
          key: meta.key,
          version: BigInt(meta.version),
          hash: meta.hash,
          updatedAt: BigInt(meta.updatedAt)
        },
        update: {
          key: meta.key,
          version: BigInt(meta.version),
          hash: meta.hash,
          updatedAt: BigInt(meta.updatedAt)
        }
      });
      return meta;
    });
  }
  async listChangedSince(version) {
    const nodes = await this.prisma.realityNode.findMany({
      where: {
        version: { gt: BigInt(version) }
      },
      orderBy: {
        version: "asc"
      }
    });
    return nodes.map((node) => ({
      key: node.key,
      version: Number(node.version),
      hash: node.hash,
      updatedAt: Number(node.updatedAt)
    }));
  }
  async getNodes(keys) {
    if (keys.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const nodes = await this.prisma.realityNode.findMany({
      where: {
        key: { in: keys }
      }
    });
    const map = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      map.set(node.key, {
        key: node.key,
        version: Number(node.version),
        hash: node.hash,
        updatedAt: Number(node.updatedAt)
      });
    }
    return map;
  }
  async getMaxVersion() {
    const result = await this.prisma.realityNode.aggregate({
      _max: { version: true }
    });
    return Number(result._max.version ?? 0);
  }
  async deleteNode(key) {
    try {
      await this.prisma.realityNode.delete({
        where: { key }
      });
    } catch {
    }
  }
  async isHealthy() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
};
function createPrismaStorage(config) {
  return new PrismaStorage(config);
}
var PRISMA_SCHEMA = `
model RealityNode {
  key       String   @id @db.VarChar(255)
  version   BigInt
  hash      String   @db.VarChar(64)
  updatedAt BigInt   @map("updated_at")

  @@index([version])
  @@map("reality_nodes")
}
`;

// src/storage/nosql/dynamodb-storage.ts
var DynamoDBStorage = class {
  constructor(config) {
    this.client = config.client;
    this.tableName = config.tableName;
    this.versionIndexName = config.versionIndexName;
  }
  async getNode(key) {
    const command = {
      TableName: this.tableName,
      Key: {
        key: { S: key }
      }
    };
    const result = await this.client.send(this.createGetItemCommand(command));
    if (!result.Item) return null;
    return this.documentToMeta(result.Item);
  }
  async setNode(meta) {
    const command = {
      TableName: this.tableName,
      Item: this.metaToDocument(meta)
    };
    await this.client.send(this.createPutItemCommand(command));
  }
  async incrementVersion(key, hash) {
    const maxVersion = await this.getMaxVersion();
    const newVersion = maxVersion + 1;
    const meta = {
      key,
      version: newVersion,
      hash,
      updatedAt: Date.now()
    };
    const command = {
      TableName: this.tableName,
      Item: this.metaToDocument(meta),
      ConditionExpression: "attribute_not_exists(#key) OR #version < :newVersion",
      ExpressionAttributeNames: {
        "#key": "key",
        "#version": "version"
      },
      ExpressionAttributeValues: {
        ":newVersion": { N: String(newVersion) }
      }
    };
    try {
      await this.client.send(this.createPutItemCommand(command));
      return meta;
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        return this.incrementVersion(key, hash);
      }
      throw error;
    }
  }
  async listChangedSince(version) {
    if (this.versionIndexName) {
      const command2 = {
        TableName: this.tableName,
        IndexName: this.versionIndexName,
        KeyConditionExpression: "#version > :version",
        ExpressionAttributeNames: {
          "#version": "version"
        },
        ExpressionAttributeValues: {
          ":version": { N: String(version) }
        }
      };
      const result2 = await this.client.send(this.createQueryCommand(command2));
      return (result2.Items ?? []).map((item) => this.documentToMeta(item)).sort((a, b) => a.version - b.version);
    }
    const command = {
      TableName: this.tableName,
      FilterExpression: "#version > :version",
      ExpressionAttributeNames: {
        "#version": "version"
      },
      ExpressionAttributeValues: {
        ":version": { N: String(version) }
      }
    };
    const result = await this.client.send(this.createScanCommand(command));
    return (result.Items ?? []).map((item) => this.documentToMeta(item)).sort((a, b) => a.version - b.version);
  }
  async getNodes(keys) {
    if (keys.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const command = {
      RequestItems: {
        [this.tableName]: {
          Keys: keys.map((key) => ({ key: { S: key } }))
        }
      }
    };
    const result = await this.client.send(this.createBatchGetItemCommand(command));
    const items = result.Responses?.[this.tableName] ?? [];
    const map = /* @__PURE__ */ new Map();
    for (const item of items) {
      const meta = this.documentToMeta(item);
      map.set(meta.key, meta);
    }
    return map;
  }
  async getMaxVersion() {
    const command = {
      TableName: this.tableName,
      ProjectionExpression: "#version",
      ExpressionAttributeNames: {
        "#version": "version"
      }
    };
    const result = await this.client.send(this.createScanCommand(command));
    const items = result.Items ?? [];
    if (items.length === 0) return 0;
    return Math.max(...items.map((item) => parseInt(item.version.N, 10)));
  }
  async deleteNode(key) {
    const command = {
      TableName: this.tableName,
      Key: {
        key: { S: key }
      }
    };
    await this.client.send(this.createDeleteItemCommand(command));
  }
  async isHealthy() {
    try {
      const command = {
        TableName: this.tableName,
        Limit: 1
      };
      await this.client.send(this.createScanCommand(command));
      return true;
    } catch {
      return false;
    }
  }
  documentToMeta(doc) {
    return {
      key: doc.key.S,
      version: parseInt(doc.version.N, 10),
      hash: doc.hash.S,
      updatedAt: parseInt(doc.updatedAt.N, 10)
    };
  }
  metaToDocument(meta) {
    return {
      key: { S: meta.key },
      version: { N: String(meta.version) },
      hash: { S: meta.hash },
      updatedAt: { N: String(meta.updatedAt) }
    };
  }
  // Command factory methods (to be replaced with actual AWS SDK commands)
  createGetItemCommand(input) {
    return { __type: "GetItem", input };
  }
  createPutItemCommand(input) {
    return { __type: "PutItem", input };
  }
  createDeleteItemCommand(input) {
    return { __type: "DeleteItem", input };
  }
  createQueryCommand(input) {
    return { __type: "Query", input };
  }
  createScanCommand(input) {
    return { __type: "Scan", input };
  }
  createBatchGetItemCommand(input) {
    return { __type: "BatchGetItem", input };
  }
};
function createDynamoDBStorage(config) {
  return new DynamoDBStorage(config);
}
var DYNAMODB_CLOUDFORMATION = `
AWSTemplateFormatVersion: '2010-09-09'
Description: Reality DynamoDB Table

Resources:
  RealityNodesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: reality-nodes
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: key
          AttributeType: S
        - AttributeName: version
          AttributeType: N
      KeySchema:
        - AttributeName: key
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: version-index
          KeySchema:
            - AttributeName: version
              KeyType: HASH
          Projection:
            ProjectionType: ALL
`;

// src/invalidation/adapters.ts
function createCallbackInvalidationAdapter(options) {
  return {
    onInvalidate: options.onInvalidate,
    beforeTransaction: options.beforeTransaction,
    afterTransaction: options.afterTransaction
  };
}
function createDrizzleInvalidationAdapter(config) {
  const pendingKeys = /* @__PURE__ */ new Set();
  return {
    onInvalidate: async (keys) => {
      if (config.onInvalidate) {
        await config.onInvalidate(keys);
      }
    },
    beforeTransaction: async (fn) => {
      pendingKeys.clear();
      return fn();
    },
    afterTransaction: async (affectedKeys) => {
      for (const key of affectedKeys) {
        pendingKeys.add(key);
      }
    }
  };
}
function createPrismaInvalidationAdapter(config) {
  return {
    onInvalidate: async (keys) => {
      if (config.onInvalidate) {
        await config.onInvalidate(keys);
      }
    },
    beforeTransaction: async (fn) => {
      return fn();
    },
    afterTransaction: async (_affectedKeys) => {
    }
  };
}
function createSQLInvalidationAdapter(config) {
  return {
    onInvalidate: async (keys) => {
      if (config.onInvalidate) {
        await config.onInvalidate(keys);
      }
    }
  };
}
function createCompositeInvalidationAdapter(adapters) {
  return {
    onInvalidate: async (keys) => {
      await Promise.all(adapters.map((a) => a.onInvalidate(keys)));
    },
    beforeTransaction: async (fn) => {
      let result;
      const chain = adapters.reduceRight(
        (next, adapter) => async () => {
          if (adapter.beforeTransaction) {
            return adapter.beforeTransaction(next);
          }
          return next();
        },
        fn
      );
      result = await chain();
      return result;
    },
    afterTransaction: async (affectedKeys) => {
      await Promise.all(
        adapters.filter((a) => a.afterTransaction).map((a) => a.afterTransaction(affectedKeys))
      );
    }
  };
}
function createLoggingInvalidationAdapter(options = {}) {
  const prefix = options.prefix ?? "[Reality]";
  const log = options.logger ?? console.log;
  return {
    onInvalidate: async (keys) => {
      log(`${prefix} Invalidated: ${keys.join(", ")}`);
    },
    beforeTransaction: async (fn) => {
      log(`${prefix} Transaction starting`);
      const result = await fn();
      log(`${prefix} Transaction completed`);
      return result;
    },
    afterTransaction: async (affectedKeys) => {
      log(`${prefix} Transaction affected: ${affectedKeys.join(", ")}`);
    }
  };
}

// src/redis/accelerator.ts
var RedisAccelerator = class {
  constructor(config) {
    this.invalidationHandlers = /* @__PURE__ */ new Set();
    this.connected = false;
    this.client = config.client;
    this.prefix = config.prefix ?? "reality:";
    this.ttl = config.ttl ?? 60;
    this.pubSubEnabled = config.pubSubEnabled ?? true;
    this.serverId = config.serverId ?? "unknown";
    this.debug = config.debug ?? false;
  }
  /**
   * Initialize Redis connection and pub/sub
   */
  async connect() {
    try {
      await this.client.ping();
      this.connected = true;
      if (this.pubSubEnabled) {
        await this.setupPubSub();
      }
      if (this.debug) {
        console.log("[Redis] Connected successfully");
      }
      return true;
    } catch (error) {
      if (this.debug) {
        console.warn("[Redis] Connection failed:", error);
      }
      this.connected = false;
      return false;
    }
  }
  /**
   * Disconnect from Redis
   */
  async disconnect() {
    try {
      if (this.pubSubEnabled) {
        await this.client.unsubscribe(`${this.prefix}invalidations`);
      }
      await this.client.quit();
      this.connected = false;
    } catch {
    }
  }
  /**
   * Check if Redis is connected
   */
  isConnected() {
    return this.connected;
  }
  /**
   * Cache node metadata
   */
  async cacheNode(meta) {
    if (!this.connected) return;
    try {
      const key = `${this.prefix}node:${meta.key}`;
      await this.client.set(key, JSON.stringify(meta), { EX: this.ttl });
    } catch (error) {
      if (this.debug) {
        console.warn("[Redis] Cache node failed:", error);
      }
    }
  }
  /**
   * Get cached node metadata
   */
  async getCachedNode(key) {
    if (!this.connected) return null;
    try {
      const data = await this.client.get(`${this.prefix}node:${key}`);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  /**
   * Invalidate cached node
   */
  async invalidateCache(key) {
    if (!this.connected) return;
    try {
      await this.client.del(`${this.prefix}node:${key}`);
    } catch {
    }
  }
  /**
   * Publish invalidation hint to other servers
   * 
   * This is a HINT only. Servers receiving this can:
   * - Proactively sync their storage
   * - Pre-warm caches
   * - Notify waiting clients early
   * 
   * BUT: They MUST NOT rely on this for correctness.
   */
  async publishInvalidation(keys) {
    if (!this.connected || !this.pubSubEnabled) return;
    try {
      const message = JSON.stringify({
        keys,
        source: this.serverId,
        timestamp: Date.now()
      });
      await this.client.publish(`${this.prefix}invalidations`, message);
      if (this.debug) {
        console.log(`[Redis] Published invalidation for ${keys.length} keys`);
      }
    } catch (error) {
      if (this.debug) {
        console.warn("[Redis] Publish invalidation failed:", error);
      }
    }
  }
  /**
   * Register handler for invalidation hints
   */
  onInvalidation(handler) {
    this.invalidationHandlers.add(handler);
    return () => this.invalidationHandlers.delete(handler);
  }
  /**
   * Cache mesh gossip for quick peer discovery
   */
  async cacheGossip(gossip) {
    if (!this.connected) return;
    try {
      const key = `${this.prefix}gossip:${gossip.serverId}`;
      await this.client.set(key, JSON.stringify(gossip), { EX: this.ttl });
    } catch {
    }
  }
  /**
   * Get cached gossip from a server
   */
  async getCachedGossip(serverId) {
    if (!this.connected) return null;
    try {
      const data = await this.client.get(`${this.prefix}gossip:${serverId}`);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  /**
   * Set up pub/sub subscriptions
   */
  async setupPubSub() {
    try {
      await this.client.subscribe(
        `${this.prefix}invalidations`,
        (message) => {
          try {
            const data = JSON.parse(message);
            if (data.source === this.serverId) return;
            for (const handler of this.invalidationHandlers) {
              try {
                handler(data.keys, data.source);
              } catch {
              }
            }
          } catch {
          }
        }
      );
    } catch (error) {
      if (this.debug) {
        console.warn("[Redis] Pub/sub setup failed:", error);
      }
    }
  }
  /**
   * Get accelerator statistics
   */
  getStats() {
    return {
      connected: this.connected,
      pubSubEnabled: this.pubSubEnabled,
      handlerCount: this.invalidationHandlers.size
    };
  }
};
function createRedisAccelerator(config) {
  return new RedisAccelerator(config);
}

// src/http/express.ts
function toRealityRequest2(req) {
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
    const realityReq = toRealityRequest2(req);
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
        const response = handleCors(toRealityRequest2(req), ["*"]);
        res.status(response.status).set(response.headers).end();
      }
    },
    {
      method: "post",
      path: "/sync",
      handler: async (req, res) => {
        const response = await handleSync(toRealityRequest2(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    },
    {
      method: "post",
      path: "/invalidate",
      handler: async (req, res) => {
        const response = await handleInvalidation(toRealityRequest2(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    },
    {
      method: "get",
      path: "/versions",
      handler: async (req, res) => {
        const response = await handleVersionQuery(toRealityRequest2(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    },
    {
      method: "get",
      path: "/health",
      handler: async (req, res) => {
        const response = await handleHealth(toRealityRequest2(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    },
    {
      method: "post",
      path: "/update",
      handler: async (req, res) => {
        const response = await handleNodeUpdate(toRealityRequest2(req), deps);
        res.status(response.status).set(response.headers).json(response.body);
      }
    }
  ];
  return { routes };
}

// src/compat/sse.ts
function formatSSEMessage(message) {
  let result = "";
  if (message.id) {
    result += `id: ${message.id}
`;
  }
  if (message.event) {
    result += `event: ${message.event}
`;
  }
  if (message.retry !== void 0) {
    result += `retry: ${message.retry}
`;
  }
  const dataLines = message.data.split("\n");
  for (const line of dataLines) {
    result += `data: ${line}
`;
  }
  result += "\n";
  return result;
}
var SSECompatAdapter = class {
  constructor(config) {
    this.config = {
      transform: (_key, data) => JSON.stringify(data),
      ...config
    };
  }
  /**
   * Handle an SSE-style request
   * 
   * Returns data in SSE format but via a normal HTTP response.
   * Client's EventSource polyfill will need to poll this endpoint.
   * 
   * @param lastEventId - The Last-Event-ID from the client
   * @param keys - Keys to check for updates (derived from URL path)
   * @returns SSE-formatted response body
   */
  async handleRequest(lastEventId, keys) {
    const lastVersion = this.parseEventId(lastEventId);
    const changedNodes = await this.config.storage.listChangedSince(lastVersion);
    const relevantChanges = changedNodes.filter(
      (node) => keys.length === 0 || keys.includes(node.key)
    );
    let body = "";
    let maxVersion = lastVersion;
    for (const node of relevantChanges) {
      let payload = null;
      if (this.config.payloadFetcher) {
        try {
          payload = await this.config.payloadFetcher(node.key);
        } catch {
          continue;
        }
      }
      const message = {
        id: this.createEventId(node),
        event: "update",
        data: this.config.transform(node.key, payload ?? { key: node.key, version: node.version })
      };
      body += formatSSEMessage(message);
      maxVersion = Math.max(maxVersion, node.version);
    }
    if (body === "") {
      const heartbeat = {
        id: `heartbeat:${Date.now()}`,
        event: "heartbeat",
        data: JSON.stringify({ timestamp: Date.now() })
      };
      body = formatSSEMessage(heartbeat);
    }
    return {
      body,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-Reality-Version": String(maxVersion)
      },
      hasChanges: relevantChanges.length > 0
    };
  }
  /**
   * Create a Fetch API handler for SSE-compatible endpoint
   */
  createFetchHandler(getKeysFromRequest) {
    return async (request) => {
      const lastEventId = request.headers.get("Last-Event-ID");
      const keys = getKeysFromRequest(request);
      const result = await this.handleRequest(lastEventId, keys);
      return new Response(result.body, {
        status: 200,
        headers: result.headers
      });
    };
  }
  /**
   * Parse event ID to extract version
   */
  parseEventId(eventId) {
    if (!eventId) return 0;
    const parts = eventId.split(":");
    const version = parseInt(parts[0] ?? "0", 10);
    return isNaN(version) ? 0 : version;
  }
  /**
   * Create event ID from node metadata
   */
  createEventId(node) {
    return `${node.version}:${node.hash}`;
  }
};
function createSSECompatAdapter(config) {
  return new SSECompatAdapter(config);
}

// src/compat/polling.ts
var PollingCompatAdapter = class {
  constructor(config) {
    this.config = config;
  }
  /**
   * Handle a polling-style request
   * 
   * @param keys - Keys to fetch
   * @param ifModifiedSince - Optional version for conditional request
   * @returns Response data and metadata
   */
  async handleRequest(keys, ifModifiedSince) {
    const metas = await this.config.storage.getNodes(keys);
    let maxVersion = 0;
    let hasChanges = false;
    for (const meta of metas.values()) {
      maxVersion = Math.max(maxVersion, meta.version);
      if (ifModifiedSince === void 0 || meta.version > ifModifiedSince) {
        hasChanges = true;
      }
    }
    if (ifModifiedSince !== void 0 && !hasChanges) {
      return {
        data: null,
        headers: {
          "X-Reality-Version": String(maxVersion)
        },
        status: 304,
        modified: false
      };
    }
    const payloads = /* @__PURE__ */ new Map();
    for (const key of keys) {
      if (this.config.payloadFetcher) {
        try {
          const payload = await this.config.payloadFetcher(key);
          payloads.set(key, payload);
        } catch {
        }
      }
    }
    const data = this.config.transform ? this.config.transform(payloads) : Object.fromEntries(payloads);
    return {
      data,
      headers: {
        "Content-Type": "application/json",
        "X-Reality-Version": String(maxVersion),
        "Cache-Control": "no-cache"
      },
      status: 200,
      modified: true
    };
  }
  /**
   * Create a Fetch API handler for polling-compatible endpoint
   */
  createFetchHandler(getKeysFromRequest) {
    return async (request) => {
      const ifModifiedSince = request.headers.get("X-Reality-Version");
      const version = ifModifiedSince ? parseInt(ifModifiedSince, 10) : void 0;
      const keys = getKeysFromRequest(request);
      const result = await this.handleRequest(keys, version);
      if (result.status === 304) {
        return new Response(null, {
          status: 304,
          headers: result.headers
        });
      }
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: result.headers
      });
    };
  }
};
function createPollingCompatAdapter(config) {
  return new PollingCompatAdapter(config);
}

export { ChangedNodeSchema, DRIZZLE_MYSQL_SCHEMA, DRIZZLE_POSTGRES_SCHEMA, DRIZZLE_SQLITE_SCHEMA, DYNAMODB_CLOUDFORMATION, DrizzleStorage, DynamoDBStorage, EmbeddedRealityServer, GossipPayloadSchema, InvalidationRequestSchema, MemoryStorage, MeshCoordinator, MeshInfoSchema, PRISMA_SCHEMA, PeerHealthSchema, PeerSummarySchema, PollingCompatAdapter, PrismaStorage, RealityExecutionModeSchema, RealityModeSchema, RealityNodeMetaSchema, RealityPersistenceModeSchema, RealityServer, RedisAccelerator, SQLDialects, SQLStorage, SSECompatAdapter, ServerConfigSchema, SyncHintSchema, SyncRequestSchema, SyncResponseSchema, createCallbackInvalidationAdapter, createCompositeInvalidationAdapter, createDrizzleInvalidationAdapter, createDrizzleStorage, createDynamoDBStorage, createEmbeddedRealityServer, createExpressMiddleware, createExpressRouter, createFetchHandler, createLoggingInvalidationAdapter, createMemoryStorage, createMeshCoordinator, createPollingCompatAdapter, createPrismaInvalidationAdapter, createPrismaStorage, createRealityServer, createRedisAccelerator, createSQLInvalidationAdapter, createSQLStorage, createSSECompatAdapter, createWorkersHandler, getSharedEmbeddedServer, handleCors, handleHealth, handleInvalidation, handleNodeUpdate, handleSync, handleVersionQuery, resetSharedEmbeddedServer };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map