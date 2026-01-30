import { S as ServerConfig, R as RealityStorage, a as RealityInvalidationAdapter, b as RealityNodeMeta, I as InvalidationConfig, c as SyncRequest, d as SyncResponse } from './index-DMEqceRR.js';
export { C as ChangedNode, e as ChangedNodeSchema, D as DatabaseAdapter, f as DatabaseAdapterFactory, G as GossipPayload, g as GossipPayloadSchema, H as HealthResponse, h as InvalidationRequest, i as InvalidationRequestSchema, j as InvalidationResponse, M as MeshInfo, k as MeshInfoSchema, l as MeshState, m as Middleware, P as PeerHealth, n as PeerHealthSchema, o as PeerInfo, p as PeerSummary, q as PeerSummarySchema, r as RealityExecutionMode, s as RealityExecutionModeSchema, t as RealityHandler, u as RealityMode, v as RealityModeSchema, w as RealityNodeMetaSchema, x as RealityPersistenceMode, y as RealityPersistenceModeSchema, z as RealityRequest, A as RealityResponse, B as ResolvedServerConfig, E as ServerConfigSchema, F as StorageFactory, J as SyncHint, K as SyncHintSchema, L as SyncRequestSchema, N as SyncResponseSchema } from './index-DMEqceRR.js';
import { MeshCoordinator } from './mesh/index.js';
export { MeshConfig, createMeshCoordinator } from './mesh/index.js';
import { RedisAccelerator } from './redis/index.js';
export { RedisAcceleratorConfig, RedisClient, createRedisAccelerator } from './redis/index.js';
import { HandlerDeps } from './http/index.js';
export { createExpressMiddleware, createExpressRouter, createFetchHandler, createWorkersHandler, handleCors, handleHealth, handleInvalidation, handleNodeUpdate, handleSync, handleVersionQuery } from './http/index.js';
export { DRIZZLE_MYSQL_SCHEMA, DRIZZLE_POSTGRES_SCHEMA, DRIZZLE_SQLITE_SCHEMA, DYNAMODB_CLOUDFORMATION, DrizzleStorage, DrizzleStorageConfig, DynamoDBStorage, DynamoDBStorageConfig, MemoryStorage, PRISMA_SCHEMA, PrismaStorage, PrismaStorageConfig, SQLDialect, SQLDialects, SQLExecutor, SQLStorage, SQLStorageConfig, createDrizzleStorage, createDynamoDBStorage, createMemoryStorage, createPrismaStorage, createSQLStorage } from './storage/index.js';
export { PollingCompatAdapter, PollingCompatConfig, SSECompatAdapter, SSECompatConfig, createPollingCompatAdapter, createSSECompatAdapter } from './compat/index.js';
import 'zod';

/**
 * @rootlodge/reality-server - Reality Server
 *
 * Main server class that brings together all components.
 *
 * IMPORTANT: Reality does NOT own your data!
 * - Storage is optional (defaults to in-memory)
 * - Reality only tracks change metadata (version/hash)
 * - Your application stores the actual payloads
 * - DB adapters are optional helpers for invalidation
 */

/**
 * Reality Server
 *
 * The main server class that coordinates storage, mesh, and HTTP handling.
 *
 * IMPORTANT: Reality does NOT own your data. It only tracks change metadata.
 * Storage is optional - use in-memory for simple cases, or skip entirely
 * and use external storage with advisory invalidation.
 *
 * @example
 * ```typescript
 * // Minimal setup - no database required!
 * const server = new RealityServer({
 *   serverId: 'server-1',
 * });
 *
 * // With mesh peers
 * const server = new RealityServer({
 *   serverId: 'server-1',
 *   peers: ['https://server-2.example.com'],
 * });
 *
 * // Invalidate when your data changes
 * await server.invalidate('chat:room:123');
 * await server.invalidateMany(['user:42', 'feed:global']);
 * ```
 */
declare class RealityServer {
    private components;
    private handlerDeps;
    constructor(config: ServerConfig, customStorage?: RealityStorage);
    /**
     * Invalidate a single key
     * Call this when your data changes - Reality will propagate the invalidation.
     *
     * @param key - The key to invalidate (e.g., 'chat:room:123')
     */
    invalidate(key: string): Promise<void>;
    /**
     * Invalidate multiple keys at once
     * More efficient than calling invalidate() multiple times.
     *
     * @param keys - Array of keys to invalidate
     */
    invalidateMany(keys: string[]): Promise<void>;
    /**
     * Set invalidation adapter for database integration
     */
    setInvalidationAdapter(adapter: RealityInvalidationAdapter): void;
    /**
     * Set custom storage adapter
     */
    setStorage(storage: RealityStorage): void;
    /**
     * Set Redis accelerator
     */
    setRedis(redis: RedisAccelerator): void;
    /**
     * Set payload fetcher for inline payloads
     */
    setPayloadFetcher(fetcher: (key: string) => Promise<unknown>): void;
    /**
     * Get the Fetch API handler
     */
    getFetchHandler(basePath?: string): (request: Request) => Promise<Response>;
    /**
     * Get handler dependencies for custom integrations
     */
    getHandlerDeps(): HandlerDeps;
    /**
     * Get storage instance
     */
    getStorage(): RealityStorage;
    /**
     * Get mesh coordinator
     */
    getMesh(): MeshCoordinator;
    /**
     * Get Redis accelerator if configured
     */
    getRedis(): RedisAccelerator | undefined;
    /**
     * Update a node's version (call this when your data changes)
     *
     * @param key - The node key
     * @param hash - Hash of the new data
     * @returns Updated node metadata
     */
    updateNode(key: string, hash: string): Promise<RealityNodeMeta>;
    /**
     * Get node metadata
     */
    getNode(key: string): Promise<RealityNodeMeta | null>;
    /**
     * Delete a node
     */
    deleteNode(key: string): Promise<void>;
    /**
     * Get server statistics
     */
    getStats(): {
        serverId: string;
        uptime: number;
        mesh: {
            serverId: string;
            maxVersionSeen: number;
            peerCount: number;
            healthyPeerCount: number;
            lastGossipTime: number;
        };
        redis: {
            connected: boolean;
            pubSubEnabled: boolean;
            handlerCount: number;
        } | undefined;
    };
}
/**
 * Create a Reality server instance
 */
declare function createRealityServer(config: ServerConfig, storage?: RealityStorage): RealityServer;

/**
 * @rootlodge/reality-server - Embedded Server
 *
 * In-process Reality server for SSR environments.
 * Works with TanStack Start, Vite SSR, Next.js, and other SSR frameworks.
 *
 * Features:
 * - No HTTP overhead - direct function calls
 * - Stateless per-request or shared state
 * - Same invalidation graph as external servers
 * - Auto-detection of SSR context
 */

/**
 * Embedded server configuration
 */
interface EmbeddedServerConfig {
    /** Server identifier (unique per instance) */
    serverId?: string;
    /** Optional storage adapter (defaults to memory) */
    storage?: RealityStorage;
    /** Invalidation configuration */
    invalidation?: InvalidationConfig;
    /** Peer server URLs (for mesh awareness in hybrid mode) */
    peers?: string[];
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * Embedded Reality Server
 *
 * Provides in-process Reality server functionality for SSR.
 * Can be used standalone or alongside external servers.
 *
 * @example
 * ```typescript
 * // TanStack Start / Vite SSR
 * import { createEmbeddedRealityServer } from '@rootlodge/reality-server';
 *
 * const server = createEmbeddedRealityServer({
 *   serverId: 'ssr-embedded',
 * });
 *
 * // Use in your SSR code
 * const response = await server.handleSync(request);
 * ```
 */
declare class EmbeddedRealityServer {
    private config;
    private storage;
    private mesh;
    private invalidationAdapter?;
    private startTime;
    constructor(config?: EmbeddedServerConfig);
    /**
     * Get server ID
     */
    getServerId(): string;
    /**
     * Handle a sync request directly (no HTTP)
     */
    handleSync(request: SyncRequest): Promise<SyncResponse>;
    /**
     * Invalidate keys
     */
    invalidate(keys: string[]): Promise<void>;
    /**
     * Invalidate many keys at once
     */
    invalidateMany(keys: string[]): Promise<void>;
    /**
     * Get node metadata
     */
    getNode(key: string): Promise<RealityNodeMeta | null>;
    /**
     * Update a node's version
     */
    updateNode(key: string, hash: string): Promise<RealityNodeMeta>;
    /**
     * Get storage instance
     */
    getStorage(): RealityStorage;
    /**
     * Set storage adapter
     */
    setStorage(storage: RealityStorage): void;
    /**
     * Set invalidation adapter
     */
    setInvalidationAdapter(adapter: RealityInvalidationAdapter): void;
    /**
     * Get handler dependencies for custom integrations
     */
    getHandlerDeps(): HandlerDeps;
    /**
     * Get mesh coordinator
     */
    getMesh(): MeshCoordinator;
    /**
     * Get server stats
     */
    getStats(): {
        serverId: string;
        uptime: number;
        mode: string;
        mesh: {
            serverId: string;
            maxVersionSeen: number;
            peerCount: number;
            healthyPeerCount: number;
            lastGossipTime: number;
        };
    };
}
/**
 * Create an embedded Reality server
 *
 * @example
 * ```typescript
 * // Basic usage
 * const server = createEmbeddedRealityServer();
 *
 * // With custom storage
 * const server = createEmbeddedRealityServer({
 *   storage: myStorage,
 *   serverId: 'my-ssr-server',
 * });
 *
 * // In SSR handler
 * export async function loader() {
 *   const server = createEmbeddedRealityServer();
 *   const response = await server.handleSync(request);
 *   return { realityState: response };
 * }
 * ```
 */
declare function createEmbeddedRealityServer(config?: EmbeddedServerConfig): EmbeddedRealityServer;
/**
 * Get or create a shared embedded server instance
 */
declare function getSharedEmbeddedServer(config?: EmbeddedServerConfig): EmbeddedRealityServer;
/**
 * Reset the shared embedded server (useful for testing)
 */
declare function resetSharedEmbeddedServer(): void;

/**
 * @rootlodge/reality-server - Invalidation Adapters
 *
 * Optional adapters for database integration.
 * Reality does NOT own your data - these are just helpers!
 *
 * Use these to:
 * - Auto-invalidate when your DB changes
 * - Hook into transactions
 * - Get advisory notifications
 *
 * You DON'T need these to use Reality!
 */

/**
 * Create a simple callback-based invalidation adapter
 *
 * @example
 * ```typescript
 * const adapter = createCallbackInvalidationAdapter({
 *   onInvalidate: async (keys) => {
 *     console.log('Keys invalidated:', keys);
 *     // Notify your cache, broadcast to clients, etc.
 *   },
 * });
 *
 * server.setInvalidationAdapter(adapter);
 * ```
 */
declare function createCallbackInvalidationAdapter(options: {
    onInvalidate: (keys: string[]) => Promise<void>;
    beforeTransaction?: <T>(fn: () => Promise<T>) => Promise<T>;
    afterTransaction?: (affectedKeys: string[]) => Promise<void>;
}): RealityInvalidationAdapter;
/**
 * Drizzle ORM invalidation adapter
 *
 * Auto-invalidates Reality keys when Drizzle transactions complete.
 *
 * @example
 * ```typescript
 * import { drizzle } from 'drizzle-orm/postgres-js';
 * import { createDrizzleInvalidationAdapter } from '@rootlodge/reality-server';
 *
 * const db = drizzle(client);
 * const reality = new RealityServer({ serverId: 'server-1' });
 *
 * const adapter = createDrizzleInvalidationAdapter({
 *   db,
 *   keyExtractor: (tableName, operation, data) => {
 *     if (tableName === 'messages') {
 *       return [`chat:room:${data.roomId}`];
 *     }
 *     return [];
 *   },
 * });
 *
 * reality.setInvalidationAdapter(adapter);
 * ```
 */
interface DrizzleInvalidationConfig {
    /** Drizzle database instance */
    db: unknown;
    /** Extract Reality keys from table/operation/data */
    keyExtractor: (tableName: string, operation: 'insert' | 'update' | 'delete', data: unknown) => string[];
    /** Custom invalidation handler */
    onInvalidate?: (keys: string[]) => Promise<void>;
}
declare function createDrizzleInvalidationAdapter(config: DrizzleInvalidationConfig): RealityInvalidationAdapter;
/**
 * Prisma ORM invalidation adapter
 *
 * Auto-invalidates Reality keys when Prisma transactions complete.
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createPrismaInvalidationAdapter } from '@rootlodge/reality-server';
 *
 * const prisma = new PrismaClient();
 * const reality = new RealityServer({ serverId: 'server-1' });
 *
 * const adapter = createPrismaInvalidationAdapter({
 *   prisma,
 *   keyExtractor: (model, operation, data) => {
 *     if (model === 'Message') {
 *       return [`chat:room:${data.roomId}`];
 *     }
 *     return [];
 *   },
 * });
 *
 * reality.setInvalidationAdapter(adapter);
 * ```
 */
interface PrismaInvalidationConfig {
    /** Prisma client instance */
    prisma: unknown;
    /** Extract Reality keys from model/operation/data */
    keyExtractor: (model: string, operation: 'create' | 'update' | 'delete' | 'upsert', data: unknown) => string[];
    /** Custom invalidation handler */
    onInvalidate?: (keys: string[]) => Promise<void>;
}
declare function createPrismaInvalidationAdapter(config: PrismaInvalidationConfig): RealityInvalidationAdapter;
/**
 * Generic SQL invalidation adapter
 *
 * For use with raw SQL or other ORMs.
 *
 * @example
 * ```typescript
 * const adapter = createSQLInvalidationAdapter({
 *   keyExtractor: (sql, params) => {
 *     // Parse SQL to extract affected tables/keys
 *     if (sql.includes('INSERT INTO messages')) {
 *       return [`chat:room:${params.roomId}`];
 *     }
 *     return [];
 *   },
 * });
 * ```
 */
interface SQLInvalidationConfig {
    /** Extract Reality keys from SQL query and params */
    keyExtractor: (sql: string, params: unknown[]) => string[];
    /** Custom invalidation handler */
    onInvalidate?: (keys: string[]) => Promise<void>;
}
declare function createSQLInvalidationAdapter(config: SQLInvalidationConfig): RealityInvalidationAdapter;
/**
 * Composite adapter that combines multiple adapters
 *
 * @example
 * ```typescript
 * const adapter = createCompositeInvalidationAdapter([
 *   drizzleAdapter,
 *   loggingAdapter,
 *   cacheAdapter,
 * ]);
 * ```
 */
declare function createCompositeInvalidationAdapter(adapters: RealityInvalidationAdapter[]): RealityInvalidationAdapter;
/**
 * Logging adapter for debugging
 */
declare function createLoggingInvalidationAdapter(options?: {
    prefix?: string;
    logger?: (message: string) => void;
}): RealityInvalidationAdapter;

export { type DrizzleInvalidationConfig, EmbeddedRealityServer, type EmbeddedServerConfig, HandlerDeps, InvalidationConfig, MeshCoordinator, type PrismaInvalidationConfig, RealityInvalidationAdapter, RealityNodeMeta, RealityServer, RealityStorage, RedisAccelerator, type SQLInvalidationConfig, ServerConfig, SyncRequest, SyncResponse, createCallbackInvalidationAdapter, createCompositeInvalidationAdapter, createDrizzleInvalidationAdapter, createEmbeddedRealityServer, createLoggingInvalidationAdapter, createPrismaInvalidationAdapter, createRealityServer, createSQLInvalidationAdapter, getSharedEmbeddedServer, resetSharedEmbeddedServer };
