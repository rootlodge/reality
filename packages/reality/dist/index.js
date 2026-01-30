'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var zod = require('zod');
var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var RealityModeSchema = zod.z.enum(["native", "sse-compat", "polling-compat"]);
var SyncHintSchema = zod.z.enum(["interaction", "focus", "idle", "mutation", "mount", "reconnect"]);
var RealityNodeMetaSchema = zod.z.object({
  key: zod.z.string(),
  version: zod.z.number().int().nonnegative(),
  hash: zod.z.string(),
  updatedAt: zod.z.number().int()
});
var PeerHealthSchema = zod.z.enum(["healthy", "degraded", "unhealthy", "unknown"]);
var PeerSummarySchema = zod.z.object({
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
var SyncResponseSchema = zod.z.object({
  changed: zod.z.record(zod.z.string(), ChangedNodeSchema),
  mesh: MeshInfoSchema,
  serverTime: zod.z.number().int()
});
var RealityPersistenceModeSchema = zod.z.enum(["none", "advisory", "external"]);
var RealityExecutionModeSchema = zod.z.enum(["client", "ssr-embedded", "server-external", "auto"]);
var RealityOptionsSchema = zod.z.object({
  /** Base URL(s) of Reality server(s) - optional for embedded mode */
  servers: zod.z.array(zod.z.string().url()).default([]),
  /** Operating mode (compatibility) */
  mode: RealityModeSchema.default("native"),
  /** Execution mode - where Reality runs */
  executionMode: RealityExecutionModeSchema.default("auto"),
  /** Custom transport (overrides executionMode) */
  transport: zod.z.custom().optional(),
  /** Client identifier (auto-generated if not provided) */
  clientId: zod.z.string().uuid().optional(),
  /** Initial known versions */
  initialKnown: zod.z.record(zod.z.string(), zod.z.number().int().nonnegative()).optional(),
  /** Request timeout in ms */
  timeout: zod.z.number().int().positive().default(1e4),
  /** Max retries per request */
  maxRetries: zod.z.number().int().nonnegative().default(3),
  /** Base delay for exponential backoff in ms */
  retryBaseDelay: zod.z.number().int().positive().default(100),
  /** Server blacklist duration in ms */
  blacklistDuration: zod.z.number().int().positive().default(3e4),
  /** Enable debug logging */
  debug: zod.z.boolean().default(false)
});
var ServerConfigSchema = zod.z.object({
  /** Server identifier */
  serverId: zod.z.string(),
  /** Peer server URLs */
  peers: zod.z.array(zod.z.string().url()).default([]),
  /** Storage adapter name */
  storage: zod.z.string().default("memory"),
  /** Enable Redis acceleration */
  redis: zod.z.object({
    enabled: zod.z.boolean(),
    url: zod.z.string().optional()
  }).optional(),
  /** CORS origins */
  corsOrigins: zod.z.array(zod.z.string()).default(["*"]),
  /** Rate limiting */
  rateLimit: zod.z.object({
    enabled: zod.z.boolean(),
    maxRequests: zod.z.number().int().positive(),
    windowMs: zod.z.number().int().positive()
  }).optional()
});

// src/utils/hash.ts
function createHash(data) {
  const str = typeof data === "string" ? data : JSON.stringify(data, sortReplacer);
  return fnv1aHash(str);
}
function fnv1aHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function sortReplacer(_key, value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.keys(value).sort().reduce((sorted, key) => {
    sorted[key] = value[key];
    return sorted;
  }, {});
}
function hashEquals(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
function combineHashes(hashes) {
  return createHash(hashes.sort().join(":"));
}

// src/utils/uuid.ts
function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = bytes[6] & 15 | 64;
    bytes[8] = bytes[8] & 63 | 128;
    return formatUUID(bytes);
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function formatUUID(bytes) {
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join("-");
}
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
function parseUUID(uuid) {
  if (!isValidUUID(uuid)) return null;
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// src/utils/time.ts
function now() {
  return Date.now();
}
function hrTime() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.timeOrigin + performance.now();
  }
  return Date.now();
}
function calculateClockSkew(serverTime, requestStartTime, responseTime) {
  const roundTripTime = responseTime - requestStartTime;
  const estimatedServerTime = requestStartTime + roundTripTime / 2;
  return serverTime - estimatedServerTime;
}
function adjustToServerTime(localTime, clockSkew) {
  return localTime + clockSkew;
}
function toISOString(timestamp) {
  return new Date(timestamp).toISOString();
}
function isStale(timestamp, staleThreshold) {
  return now() - timestamp > staleThreshold;
}
function backoffDelay(attempt, baseDelay, maxDelay = 3e4) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = delay * 0.1 * Math.random();
  return Math.floor(delay + jitter);
}
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function timeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message ?? `Operation timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
}
function throttle(fn, limit) {
  let lastRun = 0;
  let timer = null;
  return (...args) => {
    const elapsed = now() - lastRun;
    if (elapsed >= limit) {
      lastRun = now();
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastRun = now();
        timer = null;
        fn(...args);
      }, limit - elapsed);
    }
  };
}

// src/transport/transport.ts
var HttpTransport = class {
  constructor(options) {
    this.servers = /* @__PURE__ */ new Map();
    this.options = options;
    for (const url of options.servers) {
      this.servers.set(url, {
        url,
        health: "unknown",
        lastSuccess: 0,
        lastError: 0,
        consecutiveFailures: 0,
        latency: 0,
        maxVersionSeen: 0,
        blacklistedUntil: 0
      });
    }
  }
  /**
   * Check if HTTP transport is available
   */
  isAvailable() {
    return this.servers.size > 0 && this.selectServers().length > 0;
  }
  /**
   * Get transport type
   */
  getType() {
    return "http";
  }
  /**
   * Sync with the best available server
   */
  async sync(request) {
    const servers = this.selectServers();
    if (servers.length === 0) {
      throw new Error("No healthy servers available");
    }
    let lastError = null;
    for (const server of servers) {
      try {
        const response = await this.syncWithServer(server.url, request);
        this.recordSuccess(server.url, response);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordFailure(server.url, lastError);
        if (this.options.debug) {
          console.warn(`[Reality] Sync failed with ${server.url}:`, lastError.message);
        }
      }
    }
    throw lastError ?? new Error("Sync failed with all servers");
  }
  /**
   * Sync with a specific server
   */
  async syncWithServer(url, request) {
    const startTime = now();
    const fetchPromise = fetch(`${url}/reality/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(request)
    });
    const response = await timeout(
      fetchPromise,
      this.options.timeout,
      `Request to ${url} timed out`
    );
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }
    const json = await response.json();
    const parsed = SyncResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Invalid response format: ${parsed.error.message}`);
    }
    const server = this.servers.get(url);
    if (server) {
      server.latency = now() - startTime;
    }
    return parsed.data;
  }
  /**
   * Select servers in order of preference
   * Prefers: healthy > known latency > alphabetical
   */
  selectServers() {
    const currentTime = now();
    return Array.from(this.servers.values()).filter((s) => s.blacklistedUntil < currentTime).sort((a, b) => {
      const healthOrder = { healthy: 0, unknown: 1, degraded: 2, unhealthy: 3 };
      const healthDiff = healthOrder[a.health] - healthOrder[b.health];
      if (healthDiff !== 0) return healthDiff;
      const versionDiff = b.maxVersionSeen - a.maxVersionSeen;
      if (versionDiff !== 0) return versionDiff;
      if (a.latency !== 0 && b.latency !== 0) {
        return a.latency - b.latency;
      }
      return a.url.localeCompare(b.url);
    });
  }
  /**
   * Record a successful sync
   */
  recordSuccess(url, response) {
    const server = this.servers.get(url);
    if (!server) return;
    server.health = "healthy";
    server.lastSuccess = now();
    server.consecutiveFailures = 0;
    server.blacklistedUntil = 0;
    if (response.mesh.serverVersion !== void 0) {
      server.maxVersionSeen = Math.max(server.maxVersionSeen, response.mesh.serverVersion);
    }
    for (const [peerUrl, health] of Object.entries(response.mesh.peers)) {
      const peerServer = this.servers.get(peerUrl);
      if (peerServer && peerServer !== server) {
        peerServer.health = health;
      }
    }
  }
  /**
   * Record a failed sync attempt
   */
  recordFailure(url, _error) {
    const server = this.servers.get(url);
    if (!server) return;
    server.lastError = now();
    server.consecutiveFailures++;
    if (server.consecutiveFailures >= 3) {
      server.health = "unhealthy";
      server.blacklistedUntil = now() + this.options.blacklistDuration;
    } else if (server.consecutiveFailures >= 1) {
      server.health = "degraded";
    }
  }
  /**
   * Get current server status
   */
  getServerStatus() {
    return new Map(this.servers);
  }
  /**
   * Add a server dynamically (e.g., from mesh discovery)
   */
  addServer(url) {
    if (!this.servers.has(url)) {
      this.servers.set(url, {
        url,
        health: "unknown",
        lastSuccess: 0,
        lastError: 0,
        consecutiveFailures: 0,
        latency: 0,
        maxVersionSeen: 0,
        blacklistedUntil: 0
      });
    }
  }
  /**
   * Remove a server
   */
  removeServer(url) {
    this.servers.delete(url);
  }
  /**
   * Clear blacklist for a server (e.g., for manual retry)
   */
  clearBlacklist(url) {
    const server = this.servers.get(url);
    if (server) {
      server.blacklistedUntil = 0;
      server.health = "unknown";
      server.consecutiveFailures = 0;
    }
  }
  /**
   * Clear all blacklists
   */
  clearAllBlacklists() {
    for (const server of this.servers.values()) {
      server.blacklistedUntil = 0;
      server.health = "unknown";
      server.consecutiveFailures = 0;
    }
  }
};

// src/transport/embedded.ts
var embeddedServerRegistry = /* @__PURE__ */ new Map();
function registerEmbeddedServer(serverId, server) {
  embeddedServerRegistry.set(serverId, server);
}
function unregisterEmbeddedServer(serverId) {
  embeddedServerRegistry.delete(serverId);
}
function getEmbeddedServer(serverId) {
  if (serverId) {
    return embeddedServerRegistry.get(serverId);
  }
  const first = embeddedServerRegistry.values().next();
  return first.done ? void 0 : first.value;
}
function hasEmbeddedServer() {
  return embeddedServerRegistry.size > 0;
}
var EmbeddedTransport = class {
  constructor(options = {}) {
    this.serverId = options.serverId;
    this.fallbackTransport = options.fallback;
  }
  /**
   * Check if embedded transport is available
   */
  isAvailable() {
    return hasEmbeddedServer() || (this.fallbackTransport?.isAvailable() ?? false);
  }
  /**
   * Get transport type
   */
  getType() {
    if (hasEmbeddedServer()) {
      return "embedded";
    }
    return this.fallbackTransport?.getType() ?? "embedded";
  }
  /**
   * Sync using embedded server or fallback
   */
  async sync(request) {
    const server = getEmbeddedServer(this.serverId);
    if (server) {
      return server.handleSync(request);
    }
    if (this.fallbackTransport) {
      return this.fallbackTransport.sync(request);
    }
    throw new Error("No embedded server available and no fallback transport configured");
  }
  /**
   * Invalidate keys using embedded server
   */
  async invalidate(keys) {
    const server = getEmbeddedServer(this.serverId);
    if (server) {
      await server.invalidate(keys);
      return;
    }
    if (this.fallbackTransport?.invalidate) {
      await this.fallbackTransport.invalidate(keys);
      return;
    }
  }
  /**
   * Set fallback transport
   */
  setFallback(transport) {
    this.fallbackTransport = transport;
  }
};
function createAutoTransport(options) {
  if (hasEmbeddedServer()) {
    return new EmbeddedTransport({
      serverId: options.embeddedServerId,
      fallback: options.fallback
    });
  }
  if (options.fallback) {
    return options.fallback;
  }
  throw new Error("No embedded server available and no fallback transport provided");
}
var SimpleEmbeddedServer = class {
  constructor(serverId = "embedded-ssr") {
    this.nodes = /* @__PURE__ */ new Map();
    this.maxVersion = 0;
    this.serverId = serverId;
  }
  getServerId() {
    return this.serverId;
  }
  async handleSync(request) {
    const changed = {};
    for (const [key, clientVersion] of Object.entries(request.known)) {
      const meta = this.nodes.get(key);
      if (!meta) {
        changed[key] = {
          version: 0,
          hash: "",
          source: this.serverId
        };
        continue;
      }
      if (meta.version > clientVersion) {
        changed[key] = {
          version: meta.version,
          hash: meta.hash,
          source: this.serverId
        };
      }
    }
    return {
      changed,
      mesh: {
        peers: {},
        serverVersion: this.maxVersion
      },
      serverTime: Date.now()
    };
  }
  async invalidate(keys) {
    for (const key of keys) {
      const existing = this.nodes.get(key);
      if (existing) {
        this.maxVersion++;
        this.nodes.set(key, {
          ...existing,
          version: this.maxVersion,
          updatedAt: Date.now()
        });
      }
    }
  }
  async getNode(key) {
    return this.nodes.get(key) ?? null;
  }
  async updateNode(key, hash) {
    this.maxVersion++;
    const meta = {
      key,
      version: this.maxVersion,
      hash,
      updatedAt: Date.now()
    };
    this.nodes.set(key, meta);
    return meta;
  }
  /**
   * Register this server in the global registry
   */
  register() {
    registerEmbeddedServer(this.serverId, this);
  }
  /**
   * Unregister this server
   */
  unregister() {
    unregisterEmbeddedServer(this.serverId);
  }
};
function createSimpleEmbeddedServer(serverId = "embedded-ssr") {
  const server = new SimpleEmbeddedServer(serverId);
  server.register();
  return server;
}

// src/client/sync-engine.ts
var SyncEngine = class {
  constructor(config) {
    this.nodes = /* @__PURE__ */ new Map();
    this.known = /* @__PURE__ */ new Map();
    this.eventHandlers = /* @__PURE__ */ new Map();
    this.pendingSync = /* @__PURE__ */ new Set();
    this.isSyncing = false;
    this.lastSyncTime = 0;
    this.config = config;
    this.debouncedSync = debounce(() => this.performSync("idle"), config.batchDelay ?? 50);
  }
  /**
   * Subscribe to a Reality node
   */
  subscribe(key, callback, options = {}) {
    let node = this.nodes.get(key);
    if (!node) {
      node = this.createNode(key, options);
      this.nodes.set(key, node);
    }
    node.subscribers.add(callback);
    callback(this.getPublicState(node));
    if (node.status === "idle" || node.isStale) {
      this.scheduleSync(key);
    }
    return () => {
      node.subscribers.delete(callback);
      if (node.subscribers.size === 0) {
        this.nodes.delete(key);
        this.known.delete(key);
      }
    };
  }
  /**
   * Get current state of a node
   */
  getState(key) {
    const node = this.nodes.get(key);
    return node ? this.getPublicState(node) : null;
  }
  /**
   * Trigger a sync for specific keys
   */
  async syncKeys(keys, hint = "interaction") {
    for (const key of keys) {
      this.pendingSync.add(key);
    }
    await this.performSync(hint);
  }
  /**
   * Trigger a sync for all subscribed keys
   */
  async syncAll(hint = "interaction") {
    for (const key of this.nodes.keys()) {
      this.pendingSync.add(key);
    }
    await this.performSync(hint);
  }
  /**
   * Apply optimistic update
   */
  applyOptimisticUpdate(key, update) {
    const node = this.nodes.get(key);
    if (!node) {
      throw new Error(`Node ${key} not found`);
    }
    node.rollbackData = node.data;
    node.optimisticData = update(node.data);
    node.data = node.optimisticData;
    this.notifySubscribers(node);
    return () => {
      if (node.rollbackData !== void 0) {
        node.data = node.rollbackData;
        node.optimisticData = void 0;
        node.rollbackData = void 0;
        this.notifySubscribers(node);
      }
    };
  }
  /**
   * Clear optimistic state after server confirms
   */
  clearOptimistic(key) {
    const node = this.nodes.get(key);
    if (node) {
      node.optimisticData = void 0;
      node.rollbackData = void 0;
    }
  }
  /**
   * Add event handler
   */
  on(type, handler) {
    let handlers = this.eventHandlers.get(type);
    if (!handlers) {
      handlers = /* @__PURE__ */ new Set();
      this.eventHandlers.set(type, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }
  /**
   * Emit event
   */
  emit(type, data) {
    const event = {
      type,
      timestamp: now(),
      data
    };
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          if (this.config.debug) {
            console.error(`[Reality] Event handler error:`, error);
          }
        }
      }
    }
  }
  /**
   * Create a new internal node state
   */
  createNode(key, options) {
    return {
      key,
      data: options.fallback,
      meta: null,
      status: "idle",
      error: null,
      isLoading: false,
      isSyncing: false,
      isStale: true,
      lastSyncAt: null,
      options,
      subscribers: /* @__PURE__ */ new Set(),
      pendingFetch: null,
      optimisticData: void 0,
      rollbackData: void 0
    };
  }
  /**
   * Convert internal state to public state
   */
  getPublicState(node) {
    return {
      key: node.key,
      data: node.optimisticData ?? node.data,
      meta: node.meta,
      status: node.status,
      error: node.error,
      isLoading: node.isLoading,
      isSyncing: node.isSyncing,
      isStale: node.isStale,
      lastSyncAt: node.lastSyncAt
    };
  }
  /**
   * Schedule a sync operation
   */
  scheduleSync(key) {
    this.pendingSync.add(key);
    this.debouncedSync();
  }
  /**
   * Perform sync with server
   */
  async performSync(hint) {
    if (this.isSyncing) return;
    if (this.pendingSync.size === 0) return;
    this.isSyncing = true;
    const keysToSync = Array.from(this.pendingSync);
    this.pendingSync.clear();
    const knownVersions = {};
    for (const key of keysToSync) {
      const version = this.known.get(key);
      if (version !== void 0) {
        knownVersions[key] = version;
      } else {
        knownVersions[key] = 0;
      }
    }
    for (const key of keysToSync) {
      const node = this.nodes.get(key);
      if (node) {
        node.isSyncing = true;
        this.notifySubscribers(node);
      }
    }
    this.emit("sync:start", { keys: keysToSync, hint });
    try {
      const request = {
        known: knownVersions,
        clientId: this.config.clientId,
        mode: this.config.mode,
        hint,
        timestamp: now()
      };
      const response = await this.config.transport.sync(request);
      await this.reconcileResponse(response, keysToSync);
      this.lastSyncTime = now();
      this.emit("sync:complete", { keys: keysToSync, response });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      for (const key of keysToSync) {
        const node = this.nodes.get(key);
        if (node) {
          node.status = "error";
          node.error = err;
          node.isSyncing = false;
          this.notifySubscribers(node);
        }
      }
      this.emit("sync:error", { keys: keysToSync, error: err });
      if (this.config.debug) {
        console.error(`[Reality] Sync error:`, err);
      }
    } finally {
      this.isSyncing = false;
    }
  }
  /**
   * Reconcile server response with local state
   */
  async reconcileResponse(response, keysToSync) {
    this.emit("mesh:update", response.mesh);
    for (const [key, change] of Object.entries(response.changed)) {
      const node = this.nodes.get(key);
      if (!node) continue;
      const currentVersion = this.known.get(key) ?? 0;
      if (change.version > currentVersion) {
        this.known.set(key, change.version);
        const oldMeta = node.meta;
        node.meta = {
          key,
          version: change.version,
          hash: change.hash,
          updatedAt: response.serverTime
        };
        const hashChanged = !oldMeta || !hashEquals(oldMeta.hash, change.hash);
        if (hashChanged) {
          await this.fetchPayload(node, change.payload);
        }
        node.status = "idle";
        node.error = null;
        node.isSyncing = false;
        node.isStale = false;
        node.lastSyncAt = now();
        this.emit("node:update", { key, meta: node.meta, data: node.data });
      } else {
        node.isSyncing = false;
        node.isStale = false;
        node.lastSyncAt = now();
      }
      this.notifySubscribers(node);
    }
    for (const key of keysToSync) {
      if (!(key in response.changed)) {
        const node = this.nodes.get(key);
        if (node) {
          node.isSyncing = false;
          node.isStale = false;
          node.lastSyncAt = now();
          this.notifySubscribers(node);
        }
      }
    }
  }
  /**
   * Fetch payload for a node
   */
  async fetchPayload(node, inlinePayload) {
    if (inlinePayload !== void 0) {
      node.data = this.transformPayload(node, inlinePayload);
      return;
    }
    const fetcher = node.options.fetcher ?? this.config.defaultFetcher;
    if (!fetcher || !node.meta) {
      return;
    }
    if (node.pendingFetch) {
      return;
    }
    node.isLoading = true;
    node.status = "loading";
    this.notifySubscribers(node);
    try {
      node.pendingFetch = fetcher(node.key, node.meta);
      const payload = await node.pendingFetch;
      if (node.meta && node.meta.version === this.known.get(node.key)) {
        node.data = this.transformPayload(node, payload);
      }
    } catch (error) {
      node.error = error instanceof Error ? error : new Error(String(error));
      node.status = "error";
      if (this.config.debug) {
        console.error(`[Reality] Payload fetch error for ${node.key}:`, error);
      }
    } finally {
      node.isLoading = false;
      node.pendingFetch = null;
      this.notifySubscribers(node);
    }
  }
  /**
   * Transform payload using node options
   */
  transformPayload(node, payload) {
    if (node.options.schema) {
      const result = node.options.schema.safeParse(payload);
      if (!result.success) {
        throw new Error(`Validation failed: ${result.error.message}`);
      }
      return result.data;
    }
    if (node.options.transform) {
      return node.options.transform(payload);
    }
    return payload;
  }
  /**
   * Notify all subscribers of a node
   */
  notifySubscribers(node) {
    const publicState = this.getPublicState(node);
    for (const callback of node.subscribers) {
      try {
        callback(publicState);
      } catch (error) {
        if (this.config.debug) {
          console.error(`[Reality] Subscriber error for ${node.key}:`, error);
        }
      }
    }
  }
  /**
   * Get all known versions
   */
  getKnownVersions() {
    return new Map(this.known);
  }
  /**
   * Get sync statistics
   */
  getStats() {
    return {
      subscribedKeys: this.nodes.size,
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing
    };
  }
  /**
   * Destroy the sync engine
   */
  destroy() {
    this.nodes.clear();
    this.known.clear();
    this.eventHandlers.clear();
    this.pendingSync.clear();
  }
};

// src/client/reality-client.ts
function detectExecutionMode() {
  if (hasEmbeddedServer()) {
    return "ssr-embedded";
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "client";
  }
  if (typeof process !== "undefined" && process.versions?.node) {
    return "ssr-embedded";
  }
  return "client";
}
function createTransport(options) {
  if (options.transport) {
    return options.transport;
  }
  const executionMode = options.executionMode === "auto" ? detectExecutionMode() : options.executionMode;
  switch (executionMode) {
    case "ssr-embedded":
      if (options.servers.length > 0) {
        return new EmbeddedTransport({
          fallback: new HttpTransport(options)
        });
      }
      return new EmbeddedTransport();
    case "server-external":
    case "client":
    default:
      if (options.servers.length === 0) {
        throw new Error("No servers configured and no embedded server available");
      }
      return new HttpTransport(options);
  }
}
var RealityClient = class {
  constructor(options) {
    this.cleanupFns = [];
    const parsed = RealityOptionsSchema.safeParse(options);
    if (!parsed.success) {
      throw new Error(`Invalid Reality options: ${parsed.error.message}`);
    }
    this.options = {
      ...parsed.data,
      clientId: parsed.data.clientId ?? generateUUID()
    };
    this.transport = createTransport(this.options);
    this.syncEngine = new SyncEngine({
      clientId: this.options.clientId,
      mode: this.options.mode,
      transport: this.transport,
      debug: this.options.debug,
      defaultFetcher: this.defaultFetcher
    });
    this.visibility = {
      isVisible: true,
      isFocused: true,
      lastVisibleAt: now(),
      lastFocusAt: now()
    };
    this.setupEventListeners();
  }
  /**
   * Get the current transport type
   */
  getTransportType() {
    return this.transport.getType();
  }
  /**
   * Subscribe to a Reality node
   * 
   * @param key - The key identifying the reality node
   * @param options - Configuration options for this subscription
   * @returns Unsubscribe function
   */
  subscribe(key, callback, options = {}) {
    return this.syncEngine.subscribe(key, callback, options);
  }
  /**
   * Get current state of a Reality node
   */
  getState(key) {
    return this.syncEngine.getState(key);
  }
  /**
   * Create a realtime subscription helper
   * 
   * @param key - The key identifying the reality node
   * @param options - Configuration options
   * @returns Object with subscribe method and state accessor
   */
  realtime(key, options = {}) {
    return {
      subscribe: (callback) => {
        return this.subscribe(key, callback, options);
      },
      getState: () => this.getState(key),
      sync: (hint = "interaction") => this.syncKeys([key], hint)
    };
  }
  /**
   * Sync specific keys with the server
   */
  async syncKeys(keys, hint = "interaction") {
    return this.syncEngine.syncKeys(keys, hint);
  }
  /**
   * Sync all subscribed keys
   */
  async syncAll(hint = "interaction") {
    return this.syncEngine.syncAll(hint);
  }
  /**
   * Perform a mutation with optimistic update
   */
  async mutate(key, input, mutationFn, options = {}) {
    let rollback = null;
    if (options.optimisticUpdate) {
      rollback = this.syncEngine.applyOptimisticUpdate(
        key,
        (current) => options.optimisticUpdate(current, input)
      );
    }
    try {
      const result = await mutationFn(input);
      this.syncEngine.clearOptimistic(key);
      await this.syncKeys([key], "mutation");
      if (options.invalidateKeys && options.invalidateKeys.length > 0) {
        await this.syncKeys(options.invalidateKeys, "mutation");
      }
      return result;
    } catch (error) {
      if (rollback && options.rollbackOnError !== false) {
        rollback();
      }
      throw error;
    }
  }
  /**
   * Invalidate keys (mark as stale and trigger sync)
   */
  async invalidate(keys) {
    return this.syncKeys(keys, "mutation");
  }
  /**
   * Add event listener
   */
  on(event, handler) {
    return this.syncEngine.on(event, handler);
  }
  /**
   * Set default fetcher for payloads
   */
  setDefaultFetcher(fetcher) {
    this.defaultFetcher = fetcher;
  }
  /**
   * Get client ID
   */
  getClientId() {
    return this.options.clientId;
  }
  /**
   * Get current mode
   */
  getMode() {
    return this.options.mode;
  }
  /**
   * Get server status (HTTP transport only)
   */
  getServerStatus() {
    return this.transport.getServerStatus?.() ?? /* @__PURE__ */ new Map();
  }
  /**
   * Get sync statistics
   */
  getStats() {
    return this.syncEngine.getStats();
  }
  /**
   * Check if client is visible (browser/RN)
   */
  isVisible() {
    return this.visibility.isVisible;
  }
  /**
   * Check if client is focused (browser/RN)
   */
  isFocused() {
    return this.visibility.isFocused;
  }
  /**
   * Set up visibility and focus event listeners
   */
  setupEventListeners() {
    if (typeof document !== "undefined") {
      const handleVisibilityChange = () => {
        const isVisible = document.visibilityState === "visible";
        if (isVisible && !this.visibility.isVisible) {
          this.visibility.lastVisibleAt = now();
          this.syncAll("focus");
        }
        this.visibility.isVisible = isVisible;
      };
      const handleFocus = () => {
        if (!this.visibility.isFocused) {
          this.visibility.lastFocusAt = now();
          this.syncAll("focus");
        }
        this.visibility.isFocused = true;
      };
      const handleBlur = () => {
        this.visibility.isFocused = false;
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleFocus);
      window.addEventListener("blur", handleBlur);
      this.cleanupFns.push(() => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("blur", handleBlur);
      });
    }
    if (typeof global !== "undefined" && global.AppState) {
      const AppState = global.AppState;
      const subscription = AppState.addEventListener("change", (state) => {
        const isActive = state === "active";
        if (isActive && !this.visibility.isVisible) {
          this.visibility.lastVisibleAt = now();
          this.syncAll("focus");
        }
        this.visibility.isVisible = isActive;
        this.visibility.isFocused = isActive;
      });
      this.cleanupFns.push(() => subscription.remove());
    }
    if (typeof window !== "undefined" && "navigator" in window) {
      const handleOnline = () => {
        this.transport.clearAllBlacklists?.();
        this.syncAll("reconnect");
      };
      window.addEventListener("online", handleOnline);
      this.cleanupFns.push(() => window.removeEventListener("online", handleOnline));
    }
  }
  /**
   * Destroy the client and clean up resources
   */
  destroy() {
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
    this.syncEngine.destroy();
  }
};
function createRealityClient(options) {
  return new RealityClient(options);
}
var RealityContext = react.createContext(null);
function RealityProvider({ children, options, client: providedClient }) {
  const clientRef = react.useRef(providedClient ?? null);
  if (!clientRef.current) {
    clientRef.current = createRealityClient(options);
  }
  react.useEffect(() => {
    return () => {
      if (!providedClient && clientRef.current) {
        clientRef.current.destroy();
      }
    };
  }, [providedClient]);
  return /* @__PURE__ */ jsxRuntime.jsx(RealityContext.Provider, { value: clientRef.current, children });
}
function useRealityClient() {
  const client = react.useContext(RealityContext);
  if (!client) {
    throw new Error(
      "useRealityClient must be used within a RealityProvider. Wrap your app with <RealityProvider options={...}>."
    );
  }
  return client;
}
function useHasRealityContext() {
  return react.useContext(RealityContext) !== null;
}
function useReality(key, options = {}) {
  const client = useRealityClient();
  const optionsRef = react.useRef(options);
  optionsRef.current = options;
  const [state, setState] = react.useState(() => {
    const existing = client.getState(key);
    return existing ?? {
      key,
      data: options.fallback,
      meta: null,
      status: "idle",
      error: null,
      isLoading: true,
      isSyncing: false,
      isStale: true,
      lastSyncAt: null
    };
  });
  react.useEffect(() => {
    const unsubscribe = client.subscribe(key, setState, optionsRef.current);
    return () => {
      unsubscribe();
    };
  }, [client, key]);
  const sync = react.useCallback(
    async (hint = "interaction") => {
      await client.syncKeys([key], hint);
    },
    [client, key]
  );
  const invalidate = react.useCallback(async () => {
    await client.invalidate([key]);
  }, [client, key]);
  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    isSyncing: state.isSyncing,
    isStale: state.isStale,
    meta: state.meta,
    lastSyncAt: state.lastSyncAt,
    sync,
    invalidate
  };
}
function useRealityMultiple(keys, options = {}) {
  const client = useRealityClient();
  const optionsRef = react.useRef(options);
  optionsRef.current = options;
  const [states, setStates] = react.useState(() => {
    const initial = /* @__PURE__ */ new Map();
    for (const key of keys) {
      const existing = client.getState(key);
      initial.set(key, existing ?? {
        key,
        data: options.fallback,
        meta: null,
        status: "idle",
        error: null,
        isLoading: true,
        isSyncing: false,
        isStale: true,
        lastSyncAt: null
      });
    }
    return initial;
  });
  react.useEffect(() => {
    const unsubscribes = [];
    for (const key of keys) {
      const unsubscribe = client.subscribe(key, (state) => {
        setStates((prev) => {
          const next = new Map(prev);
          next.set(key, state);
          return next;
        });
      }, optionsRef.current);
      unsubscribes.push(unsubscribe);
    }
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [client, keys.join(",")]);
  const result = /* @__PURE__ */ new Map();
  for (const [key, state] of states) {
    result.set(key, {
      data: state.data,
      error: state.error,
      isLoading: state.isLoading,
      isSyncing: state.isSyncing,
      isStale: state.isStale,
      meta: state.meta,
      lastSyncAt: state.lastSyncAt,
      sync: async (hint = "interaction") => {
        await client.syncKeys([key], hint);
      },
      invalidate: async () => {
        await client.invalidate([key]);
      }
    });
  }
  return result;
}
function useMutation(key, mutationFn, options = {}) {
  const client = useRealityClient();
  const optionsRef = react.useRef(options);
  optionsRef.current = options;
  const [state, setState] = react.useState({
    data: void 0,
    error: null,
    isLoading: false
  });
  const mutate = react.useCallback(
    async (input) => {
      setState({ data: void 0, error: null, isLoading: true });
      try {
        const result = await client.mutate(key, input, mutationFn, optionsRef.current);
        setState({ data: result, error: null, isLoading: false });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({ data: void 0, error: err, isLoading: false });
        throw err;
      }
    },
    [client, key, mutationFn]
  );
  const reset = react.useCallback(() => {
    setState({ data: void 0, error: null, isLoading: false });
  }, []);
  return {
    mutate,
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    reset
  };
}
function useMutationWithInvalidation(mutationFn, invalidateKeys) {
  const client = useRealityClient();
  const [state, setState] = react.useState({
    data: void 0,
    error: null,
    isLoading: false
  });
  const mutate = react.useCallback(
    async (input) => {
      setState({ data: void 0, error: null, isLoading: true });
      try {
        const result = await mutationFn(input);
        await client.invalidate(invalidateKeys);
        setState({ data: result, error: null, isLoading: false });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({ data: void 0, error: err, isLoading: false });
        throw err;
      }
    },
    [client, mutationFn, invalidateKeys.join(",")]
  );
  const reset = react.useCallback(() => {
    setState({ data: void 0, error: null, isLoading: false });
  }, []);
  return {
    mutate,
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    reset
  };
}
function useSync() {
  const client = useRealityClient();
  const syncKeys = react.useCallback(
    async (keys, hint = "interaction") => {
      await client.syncKeys(keys, hint);
    },
    [client]
  );
  const syncAll = react.useCallback(
    async (hint = "interaction") => {
      await client.syncAll(hint);
    },
    [client]
  );
  const invalidate = react.useCallback(
    async (keys) => {
      await client.invalidate(keys);
    },
    [client]
  );
  const getStats = react.useCallback(() => client.getStats(), [client]);
  return {
    syncKeys,
    syncAll,
    invalidate,
    getStats
  };
}
function useSyncOnInteraction(keys) {
  const { syncKeys } = useSync();
  return react.useCallback(() => {
    syncKeys(keys, "interaction");
  }, [syncKeys, keys.join(",")]);
}
function useSyncOnMount(keys) {
  const { syncKeys } = useSync();
  if (typeof window !== "undefined") {
    const { useLayoutEffect } = __require("react");
    useLayoutEffect(() => {
      syncKeys(keys, "mount");
    }, [keys.join(",")]);
  }
}

// src/ssr/tanstack.ts
var TanStackRealityAdapter = class {
  constructor(config = {}) {
    this.server = null;
    this.config = config;
    this.clientId = generateUUID();
    if (!config.syncHandler && !hasEmbeddedServer()) {
      this.server = new SimpleEmbeddedServer(config.serverId ?? "tanstack-ssr");
      this.server.register();
    }
  }
  /**
   * Prefetch specified keys and return hydration state
   */
  async prefetch() {
    const keys = this.config.keys ?? [];
    const known = {};
    for (const key of keys) {
      known[key] = this.config.initialKnown?.[key] ?? 0;
    }
    const request = {
      known,
      clientId: this.clientId,
      mode: "native",
      hint: "mount",
      timestamp: Date.now()
    };
    let response;
    if (this.config.syncHandler) {
      response = await this.config.syncHandler(request);
    } else {
      const server = getEmbeddedServer(this.config.serverId);
      if (!server) {
        throw new Error("No embedded server available for TanStack adapter");
      }
      response = await server.handleSync(request);
    }
    const nodes = {};
    let maxVersion = 0;
    for (const [key, changed] of Object.entries(response.changed)) {
      if (changed.version > 0) {
        nodes[key] = {
          key,
          version: changed.version,
          hash: changed.hash,
          updatedAt: response.serverTime
        };
        maxVersion = Math.max(maxVersion, changed.version);
      }
    }
    return {
      nodes,
      maxVersion,
      serverId: this.config.serverId ?? "tanstack-ssr",
      capturedAt: Date.now()
    };
  }
  /**
   * Update a node (for use in server actions)
   */
  async updateNode(key, hash) {
    if (this.server) {
      return this.server.updateNode(key, hash);
    }
    const server = getEmbeddedServer(this.config.serverId);
    if (!server) {
      throw new Error("No embedded server available");
    }
    return server.updateNode(key, hash);
  }
  /**
   * Invalidate keys (for use in server actions)
   */
  async invalidate(keys) {
    if (this.server) {
      await this.server.invalidate(keys);
      return;
    }
    const server = getEmbeddedServer(this.config.serverId);
    if (server) {
      await server.invalidate(keys);
    }
  }
  /**
   * Get embedded transport for client use
   */
  getTransport() {
    return new EmbeddedTransport({
      serverId: this.config.serverId
    });
  }
  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.server) {
      this.server.unregister();
      this.server = null;
    }
  }
};
function createRealityTanStackAdapter(config = {}) {
  return new TanStackRealityAdapter(config);
}
function createSSRContext(config = {}) {
  return {
    adapter: createRealityTanStackAdapter(config),
    state: null
  };
}
function serializeRealityState(state) {
  return JSON.stringify(state);
}
function deserializeRealityState(serialized) {
  return JSON.parse(serialized);
}
function isSSR() {
  return typeof window === "undefined";
}
function isHydrated() {
  return typeof window !== "undefined" && hasEmbeddedServer();
}

// src/compat/sse.ts
var SSEReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
};
var RealityEventSource = class {
  constructor(url, client, options = {}) {
    // EventSource API compatibility
    this.CONNECTING = SSEReadyState.CONNECTING;
    this.OPEN = SSEReadyState.OPEN;
    this.CLOSED = SSEReadyState.CLOSED;
    this.readyState = SSEReadyState.CONNECTING;
    this.withCredentials = false;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.unsubscribe = null;
    this.eventListeners = /* @__PURE__ */ new Map();
    this.lastEventId = "";
    this.url = url;
    this.client = client;
    this.realityKey = options.realityKey ?? this.urlToKey(url);
    this.transform = options.transform ?? JSON.stringify;
    this.connect(options);
  }
  /**
   * Add event listener (EventSource API)
   */
  addEventListener(type, listener) {
    let listeners = this.eventListeners.get(type);
    if (!listeners) {
      listeners = /* @__PURE__ */ new Set();
      this.eventListeners.set(type, listeners);
    }
    listeners.add(listener);
  }
  /**
   * Remove event listener (EventSource API)
   */
  removeEventListener(type, listener) {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  /**
   * Dispatch event to listeners
   */
  dispatchEvent(type, event) {
    if (type === "message" && this.onmessage) {
      this.onmessage(event);
    }
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
  /**
   * Close the connection (EventSource API)
   */
  close() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.readyState = SSEReadyState.CLOSED;
  }
  /**
   * Connect to Reality node
   */
  connect(options) {
    const keyOptions = {
      staleTime: options.staleTime ?? 3e4,
      refetchOnFocus: true,
      refetchOnReconnect: true
    };
    this.unsubscribe = this.client.subscribe(
      this.realityKey,
      (state) => {
        this.handleStateChange(state);
      },
      keyOptions
    );
  }
  /**
   * Handle Reality state changes
   */
  handleStateChange(state) {
    if (this.readyState === SSEReadyState.CONNECTING && !state.isLoading) {
      this.readyState = SSEReadyState.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }
    if (state.error) {
      if (this.onerror) {
        this.onerror(new Event("error"));
      }
      return;
    }
    if (state.data !== void 0 && state.meta) {
      const eventId = `${state.meta.version}-${state.meta.hash}`;
      if (eventId !== this.lastEventId) {
        this.lastEventId = eventId;
        const event = {
          data: this.transform(state.data),
          lastEventId: eventId,
          origin: this.url,
          type: "message"
        };
        this.dispatchEvent("message", event);
      }
    }
  }
  /**
   * Convert URL to Reality key
   */
  urlToKey(url) {
    return url.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "").replace(/^\//, "").replace(/\//g, ":");
  }
};
function createEventSource(url, client, options = {}) {
  return new RealityEventSource(url, client, options);
}
function createEventSourceFactory(client) {
  return class extends RealityEventSource {
    constructor(url, options) {
      super(url, client, options);
    }
  };
}

// src/compat/polling.ts
function createPollingAdapter(url, callback, client, options = {}) {
  const realityKey = options.realityKey ?? urlToKey(url);
  let isActive = true;
  let lastSyncTime = null;
  let unsubscribe = null;
  const keyOptions = {
    fallback: options.initial,
    transform: options.transform,
    refetchOnFocus: options.syncOnFocus ?? true,
    refetchOnReconnect: true
  };
  unsubscribe = client.subscribe(
    realityKey,
    (state) => {
      if (!isActive) return;
      if (state.lastSyncAt) {
        lastSyncTime = state.lastSyncAt;
      }
      if (state.data !== void 0 && !state.isLoading && !state.error) {
        callback(state.data);
      }
    },
    keyOptions
  );
  if (options.syncOnVisibility !== false && typeof document !== "undefined") {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isActive) {
        client.syncKeys([realityKey], "focus");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  return {
    sync: async (hint = "interaction") => {
      if (isActive) {
        await client.syncKeys([realityKey], hint);
      }
    },
    stop: () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
    isActive: () => isActive,
    getLastSyncTime: () => lastSyncTime
  };
}
function createBatchPollingAdapter(configs, client) {
  const adapters = /* @__PURE__ */ new Map();
  for (const config of configs) {
    const adapter = createPollingAdapter(
      config.url,
      config.callback,
      client,
      config.options
    );
    adapters.set(config.url, adapter);
  }
  return {
    adapters,
    syncAll: async (hint = "interaction") => {
      const keys = configs.map((c) => c.options?.realityKey ?? urlToKey(c.url));
      await client.syncKeys(keys, hint);
    },
    stopAll: () => {
      for (const adapter of adapters.values()) {
        adapter.stop();
      }
    }
  };
}
function withInteractionSync(control, callback) {
  return () => {
    control.sync("interaction");
    callback?.();
  };
}
function urlToKey(url) {
  return url.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "").replace(/^\//, "").replace(/\//g, ":");
}

// src/index.ts
var src_default = {
  createRealityClient
};

exports.ChangedNodeSchema = ChangedNodeSchema;
exports.EmbeddedTransport = EmbeddedTransport;
exports.HttpTransport = HttpTransport;
exports.MeshInfoSchema = MeshInfoSchema;
exports.PeerHealthSchema = PeerHealthSchema;
exports.PeerSummarySchema = PeerSummarySchema;
exports.RealityClient = RealityClient;
exports.RealityEventSource = RealityEventSource;
exports.RealityExecutionModeSchema = RealityExecutionModeSchema;
exports.RealityModeSchema = RealityModeSchema;
exports.RealityNodeMetaSchema = RealityNodeMetaSchema;
exports.RealityOptionsSchema = RealityOptionsSchema;
exports.RealityPersistenceModeSchema = RealityPersistenceModeSchema;
exports.RealityProvider = RealityProvider;
exports.SSEReadyState = SSEReadyState;
exports.ServerConfigSchema = ServerConfigSchema;
exports.SimpleEmbeddedServer = SimpleEmbeddedServer;
exports.SyncEngine = SyncEngine;
exports.SyncHintSchema = SyncHintSchema;
exports.SyncRequestSchema = SyncRequestSchema;
exports.SyncResponseSchema = SyncResponseSchema;
exports.TanStackRealityAdapter = TanStackRealityAdapter;
exports.adjustToServerTime = adjustToServerTime;
exports.backoffDelay = backoffDelay;
exports.calculateClockSkew = calculateClockSkew;
exports.combineHashes = combineHashes;
exports.createAutoTransport = createAutoTransport;
exports.createBatchPollingAdapter = createBatchPollingAdapter;
exports.createDeferred = createDeferred;
exports.createEventSource = createEventSource;
exports.createEventSourceFactory = createEventSourceFactory;
exports.createHash = createHash;
exports.createPollingAdapter = createPollingAdapter;
exports.createRealityClient = createRealityClient;
exports.createRealityTanStackAdapter = createRealityTanStackAdapter;
exports.createSSRContext = createSSRContext;
exports.createSimpleEmbeddedServer = createSimpleEmbeddedServer;
exports.debounce = debounce;
exports.default = src_default;
exports.deserializeRealityState = deserializeRealityState;
exports.generateUUID = generateUUID;
exports.getEmbeddedServer = getEmbeddedServer;
exports.hasEmbeddedServer = hasEmbeddedServer;
exports.hashEquals = hashEquals;
exports.hrTime = hrTime;
exports.isHydrated = isHydrated;
exports.isSSR = isSSR;
exports.isStale = isStale;
exports.isValidUUID = isValidUUID;
exports.now = now;
exports.parseUUID = parseUUID;
exports.registerEmbeddedServer = registerEmbeddedServer;
exports.serializeRealityState = serializeRealityState;
exports.sleep = sleep;
exports.throttle = throttle;
exports.timeout = timeout;
exports.toISOString = toISOString;
exports.unregisterEmbeddedServer = unregisterEmbeddedServer;
exports.useHasRealityContext = useHasRealityContext;
exports.useMutation = useMutation;
exports.useMutationWithInvalidation = useMutationWithInvalidation;
exports.useReality = useReality;
exports.useRealityClient = useRealityClient;
exports.useRealityMultiple = useRealityMultiple;
exports.useSync = useSync;
exports.useSyncOnInteraction = useSyncOnInteraction;
exports.useSyncOnMount = useSyncOnMount;
exports.withInteractionSync = withInteractionSync;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map