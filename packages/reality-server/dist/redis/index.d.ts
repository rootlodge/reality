import { b as RealityNodeMeta, G as GossipPayload } from '../index-DMEqceRR.js';
import 'zod';

/**
 * @rootlodge/reality-server - Redis Accelerator
 *
 * Optional Redis layer for invalidation hints and mesh acceleration.
 * IMPORTANT: This is acceleration only - correctness MUST NOT depend on Redis.
 */

/**
 * Redis client interface (minimal subset)
 */
interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: {
        EX?: number;
    }): Promise<void>;
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
interface RedisAcceleratorConfig {
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
declare class RedisAccelerator {
    private client;
    private prefix;
    private ttl;
    private pubSubEnabled;
    private serverId;
    private debug;
    private invalidationHandlers;
    private connected;
    constructor(config: RedisAcceleratorConfig);
    /**
     * Initialize Redis connection and pub/sub
     */
    connect(): Promise<boolean>;
    /**
     * Disconnect from Redis
     */
    disconnect(): Promise<void>;
    /**
     * Check if Redis is connected
     */
    isConnected(): boolean;
    /**
     * Cache node metadata
     */
    cacheNode(meta: RealityNodeMeta): Promise<void>;
    /**
     * Get cached node metadata
     */
    getCachedNode(key: string): Promise<RealityNodeMeta | null>;
    /**
     * Invalidate cached node
     */
    invalidateCache(key: string): Promise<void>;
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
    publishInvalidation(keys: string[]): Promise<void>;
    /**
     * Register handler for invalidation hints
     */
    onInvalidation(handler: (keys: string[], source: string) => void): () => void;
    /**
     * Cache mesh gossip for quick peer discovery
     */
    cacheGossip(gossip: GossipPayload): Promise<void>;
    /**
     * Get cached gossip from a server
     */
    getCachedGossip(serverId: string): Promise<GossipPayload | null>;
    /**
     * Set up pub/sub subscriptions
     */
    private setupPubSub;
    /**
     * Get accelerator statistics
     */
    getStats(): {
        connected: boolean;
        pubSubEnabled: boolean;
        handlerCount: number;
    };
}
/**
 * Create Redis accelerator
 */
declare function createRedisAccelerator(config: RedisAcceleratorConfig): RedisAccelerator;

export { RedisAccelerator, type RedisAcceleratorConfig, type RedisClient, createRedisAccelerator };
