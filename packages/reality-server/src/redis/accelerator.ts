/**
 * @rootlodge/reality-server - Redis Accelerator
 * 
 * Optional Redis layer for invalidation hints and mesh acceleration.
 * IMPORTANT: This is acceleration only - correctness MUST NOT depend on Redis.
 */

import type { RealityNodeMeta, GossipPayload } from '../types';

/**
 * Redis client interface (minimal subset)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  del(key: string): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, callback: (message: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  ping(): Promise<string>;
  quit(): Promise<void>;
}

/**
 * Redis accelerator configuration
 */
export interface RedisAcceleratorConfig {
  /** Redis client instance */
  client: RedisClient;
  /** Key prefix for Reality data */
  prefix?: string;
  /** TTL for cached data in seconds */
  ttl?: number;
  /** Enable pub/sub for invalidation hints */
  pubSubEnabled?: boolean;
  /** Server ID for pub/sub filtering */
  serverId?: string;
  /** Debug logging */
  debug?: boolean;
}

/**
 * Redis Accelerator
 * 
 * Provides optional acceleration for:
 * - Invalidation hint propagation (pub/sub)
 * - Mesh gossip caching
 * - Hot node metadata caching
 * 
 * CRITICAL: All operations are best-effort.
 * The system MUST work correctly without Redis.
 */
export class RedisAccelerator {
  private client: RedisClient;
  private prefix: string;
  private ttl: number;
  private pubSubEnabled: boolean;
  private serverId: string;
  private debug: boolean;
  private invalidationHandlers: Set<(keys: string[], source: string) => void> = new Set();
  private connected = false;

  constructor(config: RedisAcceleratorConfig) {
    this.client = config.client;
    this.prefix = config.prefix ?? 'reality:';
    this.ttl = config.ttl ?? 60;
    this.pubSubEnabled = config.pubSubEnabled ?? true;
    this.serverId = config.serverId ?? 'unknown';
    this.debug = config.debug ?? false;
  }

  /**
   * Initialize Redis connection and pub/sub
   */
  async connect(): Promise<boolean> {
    try {
      await this.client.ping();
      this.connected = true;

      if (this.pubSubEnabled) {
        await this.setupPubSub();
      }

      if (this.debug) {
        console.log('[Redis] Connected successfully');
      }

      return true;
    } catch (error) {
      if (this.debug) {
        console.warn('[Redis] Connection failed:', error);
      }
      this.connected = false;
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.pubSubEnabled) {
        await this.client.unsubscribe(`${this.prefix}invalidations`);
      }
      await this.client.quit();
      this.connected = false;
    } catch {
      // Ignore disconnect errors
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Cache node metadata
   */
  async cacheNode(meta: RealityNodeMeta): Promise<void> {
    if (!this.connected) return;

    try {
      const key = `${this.prefix}node:${meta.key}`;
      await this.client.set(key, JSON.stringify(meta), { EX: this.ttl });
    } catch (error) {
      if (this.debug) {
        console.warn('[Redis] Cache node failed:', error);
      }
      // Non-fatal - continue without cache
    }
  }

  /**
   * Get cached node metadata
   */
  async getCachedNode(key: string): Promise<RealityNodeMeta | null> {
    if (!this.connected) return null;

    try {
      const data = await this.client.get(`${this.prefix}node:${key}`);
      if (!data) return null;
      return JSON.parse(data) as RealityNodeMeta;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate cached node
   */
  async invalidateCache(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.del(`${this.prefix}node:${key}`);
    } catch {
      // Non-fatal
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
  async publishInvalidation(keys: string[]): Promise<void> {
    if (!this.connected || !this.pubSubEnabled) return;

    try {
      const message = JSON.stringify({
        keys,
        source: this.serverId,
        timestamp: Date.now(),
      });

      await this.client.publish(`${this.prefix}invalidations`, message);

      if (this.debug) {
        console.log(`[Redis] Published invalidation for ${keys.length} keys`);
      }
    } catch (error) {
      if (this.debug) {
        console.warn('[Redis] Publish invalidation failed:', error);
      }
      // Non-fatal - continue without pub/sub
    }
  }

  /**
   * Register handler for invalidation hints
   */
  onInvalidation(handler: (keys: string[], source: string) => void): () => void {
    this.invalidationHandlers.add(handler);
    return () => this.invalidationHandlers.delete(handler);
  }

  /**
   * Cache mesh gossip for quick peer discovery
   */
  async cacheGossip(gossip: GossipPayload): Promise<void> {
    if (!this.connected) return;

    try {
      const key = `${this.prefix}gossip:${gossip.serverId}`;
      await this.client.set(key, JSON.stringify(gossip), { EX: this.ttl });
    } catch {
      // Non-fatal
    }
  }

  /**
   * Get cached gossip from a server
   */
  async getCachedGossip(serverId: string): Promise<GossipPayload | null> {
    if (!this.connected) return null;

    try {
      const data = await this.client.get(`${this.prefix}gossip:${serverId}`);
      if (!data) return null;
      return JSON.parse(data) as GossipPayload;
    } catch {
      return null;
    }
  }

  /**
   * Set up pub/sub subscriptions
   */
  private async setupPubSub(): Promise<void> {
    try {
      await this.client.subscribe(
        `${this.prefix}invalidations`,
        (message: string) => {
          try {
            const data = JSON.parse(message) as {
              keys: string[];
              source: string;
              timestamp: number;
            };

            // Ignore our own messages
            if (data.source === this.serverId) return;

            // Notify handlers
            for (const handler of this.invalidationHandlers) {
              try {
                handler(data.keys, data.source);
              } catch {
                // Ignore handler errors
              }
            }
          } catch {
            // Ignore invalid messages
          }
        }
      );
    } catch (error) {
      if (this.debug) {
        console.warn('[Redis] Pub/sub setup failed:', error);
      }
      // Non-fatal - continue without pub/sub
    }
  }

  /**
   * Get accelerator statistics
   */
  getStats(): {
    connected: boolean;
    pubSubEnabled: boolean;
    handlerCount: number;
  } {
    return {
      connected: this.connected,
      pubSubEnabled: this.pubSubEnabled,
      handlerCount: this.invalidationHandlers.size,
    };
  }
}

/**
 * Create Redis accelerator
 */
export function createRedisAccelerator(config: RedisAcceleratorConfig): RedisAccelerator {
  return new RedisAccelerator(config);
}
