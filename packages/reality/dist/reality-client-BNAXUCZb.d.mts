import { z } from 'zod';

/**
 * @rootlodge/reality - Core Types
 *
 * Shared type definitions for the Reality socketless real-time system.
 * These types are used by both client and server packages.
 */

declare const RealityModeSchema: z.ZodEnum<["native", "sse-compat", "polling-compat"]>;
type RealityMode = z.infer<typeof RealityModeSchema>;
declare const SyncHintSchema: z.ZodEnum<["interaction", "focus", "idle", "mutation", "mount", "reconnect"]>;
type SyncHint = z.infer<typeof SyncHintSchema>;
declare const RealityNodeMetaSchema: z.ZodObject<{
    key: z.ZodString;
    version: z.ZodNumber;
    hash: z.ZodString;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    key: string;
    version: number;
    hash: string;
    updatedAt: number;
}, {
    key: string;
    version: number;
    hash: string;
    updatedAt: number;
}>;
type RealityNodeMeta = z.infer<typeof RealityNodeMetaSchema>;
declare const PeerHealthSchema: z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>;
type PeerHealth = z.infer<typeof PeerHealthSchema>;
declare const PeerSummarySchema: z.ZodObject<{
    peer: z.ZodString;
    maxVersionSeen: z.ZodNumber;
    lastSeen: z.ZodNumber;
    health: z.ZodOptional<z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>>;
}, "strip", z.ZodTypeAny, {
    peer: string;
    maxVersionSeen: number;
    lastSeen: number;
    health?: "healthy" | "degraded" | "unhealthy" | "unknown" | undefined;
}, {
    peer: string;
    maxVersionSeen: number;
    lastSeen: number;
    health?: "healthy" | "degraded" | "unhealthy" | "unknown" | undefined;
}>;
type PeerSummary = z.infer<typeof PeerSummarySchema>;
declare const SyncRequestSchema: z.ZodObject<{
    known: z.ZodRecord<z.ZodString, z.ZodNumber>;
    clientId: z.ZodString;
    mode: z.ZodEnum<["native", "sse-compat", "polling-compat"]>;
    hint: z.ZodEnum<["interaction", "focus", "idle", "mutation", "mount", "reconnect"]>;
    timestamp: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    known: Record<string, number>;
    clientId: string;
    mode: "native" | "sse-compat" | "polling-compat";
    hint: "interaction" | "focus" | "idle" | "mutation" | "mount" | "reconnect";
    timestamp?: number | undefined;
}, {
    known: Record<string, number>;
    clientId: string;
    mode: "native" | "sse-compat" | "polling-compat";
    hint: "interaction" | "focus" | "idle" | "mutation" | "mount" | "reconnect";
    timestamp?: number | undefined;
}>;
type SyncRequest = z.infer<typeof SyncRequestSchema>;
declare const ChangedNodeSchema: z.ZodObject<{
    version: z.ZodNumber;
    hash: z.ZodString;
    source: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    version: number;
    hash: string;
    source?: string | undefined;
    payload?: unknown;
}, {
    version: number;
    hash: string;
    source?: string | undefined;
    payload?: unknown;
}>;
type ChangedNode = z.infer<typeof ChangedNodeSchema>;
declare const MeshInfoSchema: z.ZodObject<{
    peers: z.ZodRecord<z.ZodString, z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>>;
    serverVersion: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    peers: Record<string, "healthy" | "degraded" | "unhealthy" | "unknown">;
    serverVersion?: number | undefined;
}, {
    peers: Record<string, "healthy" | "degraded" | "unhealthy" | "unknown">;
    serverVersion?: number | undefined;
}>;
type MeshInfo = z.infer<typeof MeshInfoSchema>;
declare const SyncResponseSchema: z.ZodObject<{
    changed: z.ZodRecord<z.ZodString, z.ZodObject<{
        version: z.ZodNumber;
        hash: z.ZodString;
        source: z.ZodOptional<z.ZodString>;
        payload: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        version: number;
        hash: string;
        source?: string | undefined;
        payload?: unknown;
    }, {
        version: number;
        hash: string;
        source?: string | undefined;
        payload?: unknown;
    }>>;
    mesh: z.ZodObject<{
        peers: z.ZodRecord<z.ZodString, z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>>;
        serverVersion: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        peers: Record<string, "healthy" | "degraded" | "unhealthy" | "unknown">;
        serverVersion?: number | undefined;
    }, {
        peers: Record<string, "healthy" | "degraded" | "unhealthy" | "unknown">;
        serverVersion?: number | undefined;
    }>;
    serverTime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    changed: Record<string, {
        version: number;
        hash: string;
        source?: string | undefined;
        payload?: unknown;
    }>;
    mesh: {
        peers: Record<string, "healthy" | "degraded" | "unhealthy" | "unknown">;
        serverVersion?: number | undefined;
    };
    serverTime: number;
}, {
    changed: Record<string, {
        version: number;
        hash: string;
        source?: string | undefined;
        payload?: unknown;
    }>;
    mesh: {
        peers: Record<string, "healthy" | "degraded" | "unhealthy" | "unknown">;
        serverVersion?: number | undefined;
    };
    serverTime: number;
}>;
type SyncResponse = z.infer<typeof SyncResponseSchema>;
/**
 * Persistence mode for Reality
 * - 'none': No database required, in-memory only
 * - 'advisory': Optional DB adapters for invalidation hints
 * - 'external': Application manages its own persistence
 */
declare const RealityPersistenceModeSchema: z.ZodEnum<["none", "advisory", "external"]>;
type RealityPersistenceMode = z.infer<typeof RealityPersistenceModeSchema>;
/**
 * Execution mode for Reality
 * - 'client': Browser/client-side, HTTP to external servers
 * - 'ssr-embedded': SSR with in-process server (TanStack/Vite)
 * - 'server-external': Dedicated server mode
 * - 'auto': Automatically detect based on environment
 */
declare const RealityExecutionModeSchema: z.ZodEnum<["client", "ssr-embedded", "server-external", "auto"]>;
type RealityExecutionMode = z.infer<typeof RealityExecutionModeSchema>;
/**
 * Transport abstraction for Reality client
 * Allows switching between HTTP, embedded, or custom transports
 */
interface RealityTransport {
    /** Execute a sync request */
    sync(request: SyncRequest): Promise<SyncResponse>;
    /** Invalidate keys (for embedded/SSR mode) */
    invalidate?(keys: string[]): Promise<void>;
    /** Check if transport is available */
    isAvailable(): boolean;
    /** Get transport type identifier */
    getType(): 'http' | 'embedded' | 'custom';
    /** Get server status (HTTP transport only) */
    getServerStatus?(): Map<string, unknown>;
    /** Clear all blacklists (HTTP transport only) */
    clearAllBlacklists?(): void;
}
declare const RealityOptionsSchema: z.ZodObject<{
    /** Base URL(s) of Reality server(s) - optional for embedded mode */
    servers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Operating mode (compatibility) */
    mode: z.ZodDefault<z.ZodEnum<["native", "sse-compat", "polling-compat"]>>;
    /** Execution mode - where Reality runs */
    executionMode: z.ZodDefault<z.ZodEnum<["client", "ssr-embedded", "server-external", "auto"]>>;
    /** Custom transport (overrides executionMode) */
    transport: z.ZodOptional<z.ZodType<RealityTransport, z.ZodTypeDef, RealityTransport>>;
    /** Client identifier (auto-generated if not provided) */
    clientId: z.ZodOptional<z.ZodString>;
    /** Initial known versions */
    initialKnown: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    /** Request timeout in ms */
    timeout: z.ZodDefault<z.ZodNumber>;
    /** Max retries per request */
    maxRetries: z.ZodDefault<z.ZodNumber>;
    /** Base delay for exponential backoff in ms */
    retryBaseDelay: z.ZodDefault<z.ZodNumber>;
    /** Server blacklist duration in ms */
    blacklistDuration: z.ZodDefault<z.ZodNumber>;
    /** Enable debug logging */
    debug: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    mode: "native" | "sse-compat" | "polling-compat";
    servers: string[];
    executionMode: "client" | "ssr-embedded" | "server-external" | "auto";
    timeout: number;
    maxRetries: number;
    retryBaseDelay: number;
    blacklistDuration: number;
    debug: boolean;
    clientId?: string | undefined;
    transport?: RealityTransport | undefined;
    initialKnown?: Record<string, number> | undefined;
}, {
    clientId?: string | undefined;
    mode?: "native" | "sse-compat" | "polling-compat" | undefined;
    servers?: string[] | undefined;
    executionMode?: "client" | "ssr-embedded" | "server-external" | "auto" | undefined;
    transport?: RealityTransport | undefined;
    initialKnown?: Record<string, number> | undefined;
    timeout?: number | undefined;
    maxRetries?: number | undefined;
    retryBaseDelay?: number | undefined;
    blacklistDuration?: number | undefined;
    debug?: boolean | undefined;
}>;
type RealityOptions = z.input<typeof RealityOptionsSchema>;
type ResolvedRealityOptions = z.output<typeof RealityOptionsSchema>;
interface RealityKeyOptions<T = unknown> {
    /** Default value while loading */
    fallback?: T;
    /** Transform function for payload */
    transform?: (raw: unknown) => T;
    /** Validation schema */
    schema?: z.ZodType<T>;
    /** Stale time in ms - how long data is considered fresh */
    staleTime?: number;
    /** Refetch on window focus */
    refetchOnFocus?: boolean;
    /** Refetch on reconnect */
    refetchOnReconnect?: boolean;
    /** Custom fetch function for payload */
    fetcher?: (key: string, meta: RealityNodeMeta) => Promise<T>;
}
type RealityNodeStatus = 'idle' | 'loading' | 'syncing' | 'error' | 'stale';
interface RealityNodeState<T = unknown> {
    key: string;
    data: T | undefined;
    meta: RealityNodeMeta | null;
    status: RealityNodeStatus;
    error: Error | null;
    isLoading: boolean;
    isSyncing: boolean;
    isStale: boolean;
    lastSyncAt: number | null;
}
interface MutationOptions<T, TInput = unknown> {
    /** Optimistic update function */
    optimisticUpdate?: (current: T | undefined, input: TInput) => T;
    /** Rollback on error */
    rollbackOnError?: boolean;
    /** Invalidate keys after mutation */
    invalidateKeys?: string[];
}
interface MutationResult<T> {
    data: T | undefined;
    error: Error | null;
    isLoading: boolean;
}
declare const ServerConfigSchema: z.ZodObject<{
    /** Server identifier */
    serverId: z.ZodString;
    /** Peer server URLs */
    peers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Storage adapter name */
    storage: z.ZodDefault<z.ZodString>;
    /** Enable Redis acceleration */
    redis: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        url?: string | undefined;
    }, {
        enabled: boolean;
        url?: string | undefined;
    }>>;
    /** CORS origins */
    corsOrigins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Rate limiting */
    rateLimit: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        maxRequests: z.ZodNumber;
        windowMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        maxRequests: number;
        windowMs: number;
    }, {
        enabled: boolean;
        maxRequests: number;
        windowMs: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    peers: string[];
    serverId: string;
    storage: string;
    corsOrigins: string[];
    redis?: {
        enabled: boolean;
        url?: string | undefined;
    } | undefined;
    rateLimit?: {
        enabled: boolean;
        maxRequests: number;
        windowMs: number;
    } | undefined;
}, {
    serverId: string;
    peers?: string[] | undefined;
    storage?: string | undefined;
    redis?: {
        enabled: boolean;
        url?: string | undefined;
    } | undefined;
    corsOrigins?: string[] | undefined;
    rateLimit?: {
        enabled: boolean;
        maxRequests: number;
        windowMs: number;
    } | undefined;
}>;
type ServerConfig = z.input<typeof ServerConfigSchema>;
type ResolvedServerConfig = z.output<typeof ServerConfigSchema>;
interface RealityStorage {
    /** Get metadata for a node */
    getNode(key: string): Promise<RealityNodeMeta | null>;
    /** Set metadata for a node */
    setNode(meta: RealityNodeMeta): Promise<void>;
    /** Increment version and update hash */
    incrementVersion(key: string, hash: string): Promise<RealityNodeMeta>;
    /** List nodes changed since a given version */
    listChangedSince(version: number): Promise<RealityNodeMeta[]>;
    /** Get multiple nodes by keys */
    getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>>;
    /** Get current max version across all nodes */
    getMaxVersion(): Promise<number>;
    /** Delete a node */
    deleteNode(key: string): Promise<void>;
    /** Health check */
    isHealthy(): Promise<boolean>;
}
interface DatabaseAdapter {
    /** Fetch payload for a key */
    fetchPayload<T = unknown>(key: string): Promise<T | null>;
    /** Store payload for a key */
    storePayload<T = unknown>(key: string, payload: T): Promise<void>;
    /** Delete payload */
    deletePayload(key: string): Promise<void>;
    /** Batch fetch payloads */
    fetchPayloads<T = unknown>(keys: string[]): Promise<Map<string, T>>;
}
interface SSEMessage {
    id?: string;
    event?: string;
    data: string;
    retry?: number;
}
interface PollingConfig {
    /** Minimum interval between syncs in ms */
    minInterval: number;
    /** Maximum interval between syncs in ms */
    maxInterval: number;
    /** Backoff multiplier on error */
    backoffMultiplier: number;
}
/**
 * Invalidation adapter for advisory database integration
 * Reality does NOT own your data - this is optional!
 */
interface RealityInvalidationAdapter {
    /** Hook called when keys should be invalidated */
    onInvalidate(keys: string[]): Promise<void>;
    /** Hook called before a transaction (for auto-invalidation) */
    beforeTransaction?<T>(fn: () => Promise<T>): Promise<T>;
    /** Hook called after a transaction (for auto-invalidation) */
    afterTransaction?(affectedKeys: string[]): Promise<void>;
}
/**
 * Configuration for invalidation behavior
 */
interface InvalidationConfig {
    /** Invalidation adapter instance */
    adapter?: RealityInvalidationAdapter;
    /** Persistence mode */
    mode?: RealityPersistenceMode;
}
type RealityEventType = 'sync:start' | 'sync:complete' | 'sync:error' | 'node:update' | 'node:delete' | 'mesh:update' | 'server:healthy' | 'server:unhealthy';
interface RealityEvent<T = unknown> {
    type: RealityEventType;
    timestamp: number;
    data: T;
}
type RealityEventHandler<T = unknown> = (event: RealityEvent<T>) => void;
type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
type Awaitable<T> = T | Promise<T>;
type KeyOf<T> = Extract<keyof T, string>;

/**
 * @rootlodge/reality - Reality Client
 *
 * Main client class for the Reality system.
 * Provides the core API for subscribing to real-time data.
 */

/**
 * Reality Client - Main entry point for the Reality system
 */
declare class RealityClient {
    private options;
    private transport;
    private syncEngine;
    private visibility;
    private cleanupFns;
    private defaultFetcher?;
    constructor(options: RealityOptions);
    /**
     * Get the current transport type
     */
    getTransportType(): 'http' | 'embedded' | 'custom';
    /**
     * Subscribe to a Reality node
     *
     * @param key - The key identifying the reality node
     * @param options - Configuration options for this subscription
     * @returns Unsubscribe function
     */
    subscribe<T>(key: string, callback: (state: RealityNodeState<T>) => void, options?: RealityKeyOptions<T>): () => void;
    /**
     * Get current state of a Reality node
     */
    getState<T>(key: string): RealityNodeState<T> | null;
    /**
     * Create a realtime subscription helper
     *
     * @param key - The key identifying the reality node
     * @param options - Configuration options
     * @returns Object with subscribe method and state accessor
     */
    realtime<T>(key: string, options?: RealityKeyOptions<T>): {
        subscribe: (callback: (state: RealityNodeState<T>) => void) => () => void;
        getState: () => RealityNodeState<T> | null;
        sync: (hint?: SyncHint) => Promise<void>;
    };
    /**
     * Sync specific keys with the server
     */
    syncKeys(keys: string[], hint?: SyncHint): Promise<void>;
    /**
     * Sync all subscribed keys
     */
    syncAll(hint?: SyncHint): Promise<void>;
    /**
     * Perform a mutation with optimistic update
     */
    mutate<T, TInput = unknown>(key: string, input: TInput, mutationFn: (input: TInput) => Promise<T>, options?: MutationOptions<T, TInput>): Promise<T>;
    /**
     * Invalidate keys (mark as stale and trigger sync)
     */
    invalidate(keys: string[]): Promise<void>;
    /**
     * Add event listener
     */
    on<T = unknown>(event: RealityEventType, handler: RealityEventHandler<T>): () => void;
    /**
     * Set default fetcher for payloads
     */
    setDefaultFetcher(fetcher: (key: string, meta: RealityNodeMeta) => Promise<unknown>): void;
    /**
     * Get client ID
     */
    getClientId(): string;
    /**
     * Get current mode
     */
    getMode(): "native" | "sse-compat" | "polling-compat";
    /**
     * Get server status (HTTP transport only)
     */
    getServerStatus(): Map<any, any>;
    /**
     * Get sync statistics
     */
    getStats(): {
        subscribedKeys: number;
        lastSyncTime: number;
        isSyncing: boolean;
    };
    /**
     * Check if client is visible (browser/RN)
     */
    isVisible(): boolean;
    /**
     * Check if client is focused (browser/RN)
     */
    isFocused(): boolean;
    /**
     * Set up visibility and focus event listeners
     */
    private setupEventListeners;
    /**
     * Destroy the client and clean up resources
     */
    destroy(): void;
}
/**
 * Create a Reality client instance
 */
declare function createRealityClient(options: RealityOptions): RealityClient;

export { type Awaitable as A, type RealityNodeStatus as B, type ChangedNode as C, type DatabaseAdapter as D, type RealityOptions as E, RealityOptionsSchema as F, type RealityPersistenceMode as G, RealityPersistenceModeSchema as H, type InvalidationConfig as I, type RealityStorage as J, type KeyOf as K, type ResolvedServerConfig as L, type MeshInfo as M, type SSEMessage as N, type ServerConfig as O, type PeerHealth as P, ServerConfigSchema as Q, type RealityMode as R, type SyncHint as S, SyncHintSchema as T, SyncRequestSchema as U, SyncResponseSchema as V, type RealityTransport as a, type RealityNodeMeta as b, type RealityNodeState as c, type RealityKeyOptions as d, type RealityEventType as e, type RealityEventHandler as f, type ResolvedRealityOptions as g, type SyncRequest as h, type SyncResponse as i, createRealityClient as j, ChangedNodeSchema as k, type DeepPartial as l, MeshInfoSchema as m, type MutationOptions as n, type MutationResult as o, PeerHealthSchema as p, type PeerSummary as q, PeerSummarySchema as r, type PollingConfig as s, RealityClient as t, type RealityEvent as u, type RealityExecutionMode as v, RealityExecutionModeSchema as w, type RealityInvalidationAdapter as x, RealityModeSchema as y, RealityNodeMetaSchema as z };
