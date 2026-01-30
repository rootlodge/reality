import { R as RealityMode, a as RealityTransport, b as RealityNodeMeta, c as RealityNodeState, d as RealityKeyOptions, S as SyncHint, e as RealityEventType, f as RealityEventHandler, g as ResolvedRealityOptions, h as SyncRequest, i as SyncResponse, P as PeerHealth, j as createRealityClient } from './reality-client-BNAXUCZb.mjs';
export { A as Awaitable, C as ChangedNode, k as ChangedNodeSchema, D as DatabaseAdapter, l as DeepPartial, I as InvalidationConfig, K as KeyOf, M as MeshInfo, m as MeshInfoSchema, n as MutationOptions, o as MutationResult, p as PeerHealthSchema, q as PeerSummary, r as PeerSummarySchema, s as PollingConfig, t as RealityClient, u as RealityEvent, v as RealityExecutionMode, w as RealityExecutionModeSchema, x as RealityInvalidationAdapter, y as RealityModeSchema, z as RealityNodeMetaSchema, B as RealityNodeStatus, E as RealityOptions, F as RealityOptionsSchema, G as RealityPersistenceMode, H as RealityPersistenceModeSchema, J as RealityStorage, L as ResolvedServerConfig, N as SSEMessage, O as ServerConfig, Q as ServerConfigSchema, T as SyncHintSchema, U as SyncRequestSchema, V as SyncResponseSchema } from './reality-client-BNAXUCZb.mjs';
export { RealityProvider, RealityProviderProps, UseMutationReturn, UseRealityReturn, UseSyncReturn, useHasRealityContext, useMutation, useMutationWithInvalidation, useReality, useRealityClient, useRealityMultiple, useSync, useSyncOnInteraction, useSyncOnMount } from './react/index.mjs';
export { EventSourceOptions, PollingAdapterControl, PollingAdapterOptions, PollingCallback, RealityEventSource, SSEEventListener, SSEMessageEvent, SSEReadyState, createBatchPollingAdapter, createEventSource, createEventSourceFactory, createPollingAdapter, withInteractionSync } from './compat/index.mjs';
import 'zod';
import 'react/jsx-runtime';
import 'react';

/**
 * @rootlodge/reality - Hash Utilities
 *
 * Deterministic hashing for content comparison.
 * Works in all environments: Node.js, Browser, React Native, Edge.
 */
/**
 * Generate a deterministic hash from any serializable value.
 * Uses a fast, non-cryptographic hash suitable for content comparison.
 */
declare function createHash(data: unknown): string;
/**
 * Compare two hashes for equality
 */
declare function hashEquals(a: string, b: string): boolean;
/**
 * Generate a composite hash from multiple hashes
 */
declare function combineHashes(hashes: string[]): string;

/**
 * @rootlodge/reality - UUID Utilities
 *
 * Cross-platform UUID generation for client identification.
 */
/**
 * Generate a v4 UUID
 * Works in all environments: Node.js, Browser, React Native, Edge
 */
declare function generateUUID(): string;
/**
 * Validate UUID format
 */
declare function isValidUUID(str: string): boolean;
/**
 * Parse UUID to bytes
 */
declare function parseUUID(uuid: string): Uint8Array | null;

/**
 * @rootlodge/reality - Time Utilities
 *
 * Cross-platform time utilities with clock skew handling.
 */
/**
 * Get current timestamp in milliseconds
 */
declare function now(): number;
/**
 * Get high-resolution time if available, otherwise fall back to Date.now()
 */
declare function hrTime(): number;
/**
 * Calculate server time offset from response
 */
declare function calculateClockSkew(serverTime: number, requestStartTime: number, responseTime: number): number;
/**
 * Adjust local time to estimated server time
 */
declare function adjustToServerTime(localTime: number, clockSkew: number): number;
/**
 * Format timestamp as ISO string
 */
declare function toISOString(timestamp: number): string;
/**
 * Check if a timestamp is stale (older than threshold)
 */
declare function isStale(timestamp: number, staleThreshold: number): boolean;
/**
 * Calculate exponential backoff delay
 */
declare function backoffDelay(attempt: number, baseDelay: number, maxDelay?: number): number;
/**
 * Create a deferred promise
 */
interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
}
declare function createDeferred<T>(): Deferred<T>;
/**
 * Create a timeout promise
 */
declare function timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T>;
/**
 * Sleep for a specified duration
 */
declare function sleep(ms: number): Promise<void>;
/**
 * Debounce a function
 */
declare function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(fn: T, delay: number): (...args: Parameters<T>) => void;
/**
 * Throttle a function
 */
declare function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(fn: T, limit: number): (...args: Parameters<T>) => void;

/**
 * @rootlodge/reality - Sync Engine
 *
 * Core synchronization logic for the Reality client.
 * Handles batching, deduplication, and state reconciliation.
 */

/**
 * Subscription callback type
 */
type SubscriptionCallback<T = unknown> = (state: RealityNodeState<T>) => void;
/**
 * Sync engine configuration
 */
interface SyncEngineConfig {
    clientId: string;
    mode: RealityMode;
    transport: RealityTransport;
    debug: boolean;
    batchDelay?: number;
    defaultFetcher?: (key: string, meta: RealityNodeMeta) => Promise<unknown>;
}
/**
 * Sync Engine - manages all Reality node states
 */
declare class SyncEngine {
    private config;
    private nodes;
    private known;
    private eventHandlers;
    private pendingSync;
    private debouncedSync;
    private isSyncing;
    private lastSyncTime;
    constructor(config: SyncEngineConfig);
    /**
     * Subscribe to a Reality node
     */
    subscribe<T>(key: string, callback: SubscriptionCallback<T>, options?: RealityKeyOptions<T>): () => void;
    /**
     * Get current state of a node
     */
    getState<T>(key: string): RealityNodeState<T> | null;
    /**
     * Trigger a sync for specific keys
     */
    syncKeys(keys: string[], hint?: SyncHint): Promise<void>;
    /**
     * Trigger a sync for all subscribed keys
     */
    syncAll(hint?: SyncHint): Promise<void>;
    /**
     * Apply optimistic update
     */
    applyOptimisticUpdate<T>(key: string, update: (current: T | undefined) => T): () => void;
    /**
     * Clear optimistic state after server confirms
     */
    clearOptimistic(key: string): void;
    /**
     * Add event handler
     */
    on<T = unknown>(type: RealityEventType, handler: RealityEventHandler<T>): () => void;
    /**
     * Emit event
     */
    private emit;
    /**
     * Create a new internal node state
     */
    private createNode;
    /**
     * Convert internal state to public state
     */
    private getPublicState;
    /**
     * Schedule a sync operation
     */
    private scheduleSync;
    /**
     * Perform sync with server
     */
    private performSync;
    /**
     * Reconcile server response with local state
     */
    private reconcileResponse;
    /**
     * Fetch payload for a node
     */
    private fetchPayload;
    /**
     * Transform payload using node options
     */
    private transformPayload;
    /**
     * Notify all subscribers of a node
     */
    private notifySubscribers;
    /**
     * Get all known versions
     */
    getKnownVersions(): Map<string, number>;
    /**
     * Get sync statistics
     */
    getStats(): {
        subscribedKeys: number;
        lastSyncTime: number;
        isSyncing: boolean;
    };
    /**
     * Destroy the sync engine
     */
    destroy(): void;
}

/**
 * @rootlodge/reality - Transport Layer
 *
 * Handles HTTP communication with Reality servers.
 * Supports all environments: Node.js, Browser, React Native, Edge.
 */

/**
 * Server health status tracking
 */
interface ServerStatus {
    url: string;
    health: PeerHealth;
    lastSuccess: number;
    lastError: number;
    consecutiveFailures: number;
    latency: number;
    maxVersionSeen: number;
    blacklistedUntil: number;
}
/**
 * HTTP Transport - communicates with external Reality servers via HTTP
 * Implements the RealityTransport interface
 */
declare class HttpTransport implements RealityTransport {
    private servers;
    private options;
    constructor(options: ResolvedRealityOptions);
    /**
     * Check if HTTP transport is available
     */
    isAvailable(): boolean;
    /**
     * Get transport type
     */
    getType(): 'http' | 'embedded' | 'custom';
    /**
     * Sync with the best available server
     */
    sync(request: SyncRequest): Promise<SyncResponse>;
    /**
     * Sync with a specific server
     */
    private syncWithServer;
    /**
     * Select servers in order of preference
     * Prefers: healthy > known latency > alphabetical
     */
    private selectServers;
    /**
     * Record a successful sync
     */
    private recordSuccess;
    /**
     * Record a failed sync attempt
     */
    private recordFailure;
    /**
     * Get current server status
     */
    getServerStatus(): Map<string, ServerStatus>;
    /**
     * Add a server dynamically (e.g., from mesh discovery)
     */
    addServer(url: string): void;
    /**
     * Remove a server
     */
    removeServer(url: string): void;
    /**
     * Clear blacklist for a server (e.g., for manual retry)
     */
    clearBlacklist(url: string): void;
    /**
     * Clear all blacklists
     */
    clearAllBlacklists(): void;
}

/**
 * @rootlodge/reality - Embedded Transport
 *
 * In-process transport for SSR/TanStack/Vite environments.
 * No HTTP overhead - direct function calls to embedded server.
 */

/**
 * Embedded server interface
 * This is a minimal interface that embedded servers must implement
 */
interface EmbeddedRealityServer {
    /** Handle a sync request directly */
    handleSync(request: SyncRequest): Promise<SyncResponse>;
    /** Invalidate keys */
    invalidate(keys: string[]): Promise<void>;
    /** Get node metadata */
    getNode(key: string): Promise<RealityNodeMeta | null>;
    /** Update a node's version */
    updateNode(key: string, hash: string): Promise<RealityNodeMeta>;
    /** Get server ID */
    getServerId(): string;
}
/**
 * Register an embedded server instance
 */
declare function registerEmbeddedServer(serverId: string, server: EmbeddedRealityServer): void;
/**
 * Unregister an embedded server instance
 */
declare function unregisterEmbeddedServer(serverId: string): void;
/**
 * Get an embedded server by ID
 */
declare function getEmbeddedServer(serverId?: string): EmbeddedRealityServer | undefined;
/**
 * Check if any embedded server is available
 */
declare function hasEmbeddedServer(): boolean;
/**
 * Embedded Transport - in-process communication for SSR
 * Implements the RealityTransport interface
 */
declare class EmbeddedTransport implements RealityTransport {
    private serverId?;
    private fallbackTransport?;
    constructor(options?: {
        /** Specific server ID to use */
        serverId?: string;
        /** Fallback transport if embedded not available */
        fallback?: RealityTransport;
    });
    /**
     * Check if embedded transport is available
     */
    isAvailable(): boolean;
    /**
     * Get transport type
     */
    getType(): 'http' | 'embedded' | 'custom';
    /**
     * Sync using embedded server or fallback
     */
    sync(request: SyncRequest): Promise<SyncResponse>;
    /**
     * Invalidate keys using embedded server
     */
    invalidate(keys: string[]): Promise<void>;
    /**
     * Set fallback transport
     */
    setFallback(transport: RealityTransport): void;
}
/**
 * Create an auto-selecting transport
 * Prefers embedded, falls back to HTTP
 */
declare function createAutoTransport(options: {
    /** HTTP server URLs for fallback */
    servers?: string[];
    /** Preferred embedded server ID */
    embeddedServerId?: string;
    /** Custom fallback transport */
    fallback?: RealityTransport;
}): RealityTransport;
/**
 * Simple in-memory embedded server for SSR
 * Use this for basic SSR scenarios where you don't need full server features
 */
declare class SimpleEmbeddedServer implements EmbeddedRealityServer {
    private nodes;
    private maxVersion;
    private serverId;
    constructor(serverId?: string);
    getServerId(): string;
    handleSync(request: SyncRequest): Promise<SyncResponse>;
    invalidate(keys: string[]): Promise<void>;
    getNode(key: string): Promise<RealityNodeMeta | null>;
    updateNode(key: string, hash: string): Promise<RealityNodeMeta>;
    /**
     * Register this server in the global registry
     */
    register(): void;
    /**
     * Unregister this server
     */
    unregister(): void;
}
/**
 * Create and register a simple embedded server
 */
declare function createSimpleEmbeddedServer(serverId?: string): SimpleEmbeddedServer;

/**
 * @rootlodge/reality - TanStack Integration
 *
 * Helpers for integrating Reality with TanStack Start, TanStack Router,
 * and other TanStack ecosystem tools.
 */

/**
 * TanStack adapter configuration
 */
interface TanStackAdapterConfig {
    /** Keys to prefetch during SSR */
    keys?: string[];
    /** Server ID for the embedded server */
    serverId?: string;
    /** Initial known versions (from hydration) */
    initialKnown?: Record<string, number>;
    /** Custom sync handler (for connecting to external embedded server) */
    syncHandler?: (request: SyncRequest) => Promise<SyncResponse>;
}
/**
 * TanStack adapter state for hydration
 */
interface TanStackRealityState {
    /** Node metadata keyed by key */
    nodes: Record<string, RealityNodeMeta>;
    /** Max version seen */
    maxVersion: number;
    /** Server ID */
    serverId: string;
    /** Timestamp of state capture */
    capturedAt: number;
}
/**
 * TanStack Reality Adapter
 *
 * Provides SSR support for TanStack Start and TanStack Router.
 *
 * @example
 * ```typescript
 * // In your TanStack Start loader
 * import { createRealityTanStackAdapter } from '@rootlodge/reality/tanstack';
 *
 * export const loader = async () => {
 *   const reality = createRealityTanStackAdapter({
 *     keys: ['chat:room:123', 'user:profile'],
 *   });
 *
 *   // Prefetch data and get hydration state
 *   const state = await reality.prefetch();
 *
 *   return {
 *     realityState: state,
 *   };
 * };
 *
 * // In your component
 * function Chat({ realityState }) {
 *   return (
 *     <RealityProvider
 *       hydrationState={realityState}
 *       mode="auto"
 *     >
 *       <ChatMessages />
 *     </RealityProvider>
 *   );
 * }
 * ```
 */
declare class TanStackRealityAdapter {
    private config;
    private server;
    private clientId;
    constructor(config?: TanStackAdapterConfig);
    /**
     * Prefetch specified keys and return hydration state
     */
    prefetch(): Promise<TanStackRealityState>;
    /**
     * Update a node (for use in server actions)
     */
    updateNode(key: string, hash: string): Promise<RealityNodeMeta>;
    /**
     * Invalidate keys (for use in server actions)
     */
    invalidate(keys: string[]): Promise<void>;
    /**
     * Get embedded transport for client use
     */
    getTransport(): EmbeddedTransport;
    /**
     * Cleanup resources
     */
    cleanup(): void;
}
/**
 * Create a TanStack Reality adapter
 *
 * @example
 * ```typescript
 * // Basic usage in loader
 * const adapter = createRealityTanStackAdapter({
 *   keys: ['chat:room:123'],
 * });
 * const state = await adapter.prefetch();
 * ```
 */
declare function createRealityTanStackAdapter(config?: TanStackAdapterConfig): TanStackRealityAdapter;
/**
 * SSR Context for React Server Components
 */
interface SSRContext {
    adapter: TanStackRealityAdapter;
    state: TanStackRealityState | null;
}
/**
 * Create SSR context for use in React Server Components
 */
declare function createSSRContext(config?: TanStackAdapterConfig): SSRContext;
/**
 * Helper to serialize Reality state for hydration
 */
declare function serializeRealityState(state: TanStackRealityState): string;
/**
 * Helper to deserialize Reality state from hydration
 */
declare function deserializeRealityState(serialized: string): TanStackRealityState;
/**
 * Check if we're in SSR context
 */
declare function isSSR(): boolean;
/**
 * Check if Reality is hydrated
 */
declare function isHydrated(): boolean;

/**
 * @rootlodge/reality - Client Package Entry Point
 *
 * Socketless Real-Time Infrastructure
 *
 * IMPORTANT: Reality does NOT own your data!
 * - Reality only tracks change metadata (version/hash)
 * - Your application stores the actual payloads
 * - Works without any database
 *
 * @packageDocumentation
 */

/**
 * Default export for convenient imports
 */
declare const _default: {
    createRealityClient: typeof createRealityClient;
};

export { type Deferred, type EmbeddedRealityServer, EmbeddedTransport, HttpTransport, PeerHealth, RealityEventHandler, RealityEventType, RealityKeyOptions, RealityMode, RealityNodeMeta, RealityNodeState, RealityTransport, ResolvedRealityOptions, type SSRContext, type ServerStatus, SimpleEmbeddedServer, SyncEngine, SyncHint, SyncRequest, SyncResponse, type TanStackAdapterConfig, TanStackRealityAdapter, type TanStackRealityState, adjustToServerTime, backoffDelay, calculateClockSkew, combineHashes, createAutoTransport, createDeferred, createHash, createRealityClient as createReality, createRealityClient, createRealityTanStackAdapter, createSSRContext, createSimpleEmbeddedServer, debounce, _default as default, deserializeRealityState, generateUUID, getEmbeddedServer, hasEmbeddedServer, hashEquals, hrTime, isHydrated, isSSR, isStale, isValidUUID, now, parseUUID, registerEmbeddedServer, serializeRealityState, sleep, throttle, timeout, toISOString, unregisterEmbeddedServer };
