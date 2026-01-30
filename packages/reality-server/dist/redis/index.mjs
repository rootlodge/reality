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

export { RedisAccelerator, createRedisAccelerator };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map