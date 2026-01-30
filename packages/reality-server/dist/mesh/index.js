'use strict';

var zod = require('zod');

// src/types/index.ts
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
zod.z.object({
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
var GossipPayloadSchema = zod.z.object({
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
zod.z.object({
  keys: zod.z.array(zod.z.string()).min(1),
  source: zod.z.string().optional(),
  timestamp: zod.z.number().int().optional()
});

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

exports.MeshCoordinator = MeshCoordinator;
exports.createMeshCoordinator = createMeshCoordinator;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map