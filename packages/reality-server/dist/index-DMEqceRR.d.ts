import { z } from 'zod';

/**
 * @rootlodge/reality-server - Server Types
 *
 * Type definitions for the Reality server.
 * Shared types are duplicated here to avoid circular dependencies.
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
declare const ServerConfigSchema: z.ZodObject<{
    /** Server identifier (unique across mesh) */
    serverId: z.ZodString;
    /** HTTP port to listen on */
    port: z.ZodDefault<z.ZodNumber>;
    /** Host to bind to */
    host: z.ZodDefault<z.ZodString>;
    /** Peer server URLs for mesh */
    peers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** CORS configuration */
    cors: z.ZodDefault<z.ZodObject<{
        origins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        credentials: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        origins: string[];
        credentials: boolean;
    }, {
        origins?: string[] | undefined;
        credentials?: boolean | undefined;
    }>>;
    /** Rate limiting */
    rateLimit: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        maxRequests: z.ZodDefault<z.ZodNumber>;
        windowMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        maxRequests: number;
        windowMs: number;
    }, {
        enabled?: boolean | undefined;
        maxRequests?: number | undefined;
        windowMs?: number | undefined;
    }>>;
    /** Enable debug logging */
    debug: z.ZodDefault<z.ZodBoolean>;
    /** Storage configuration */
    storage: z.ZodDefault<z.ZodObject<{
        type: z.ZodDefault<z.ZodEnum<["memory", "drizzle", "prisma", "sql", "dynamodb", "redis", "custom"]>>;
        connectionString: z.ZodOptional<z.ZodString>;
        tableName: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "custom" | "memory" | "drizzle" | "prisma" | "sql" | "dynamodb" | "redis";
        tableName: string;
        connectionString?: string | undefined;
    }, {
        type?: "custom" | "memory" | "drizzle" | "prisma" | "sql" | "dynamodb" | "redis" | undefined;
        connectionString?: string | undefined;
        tableName?: string | undefined;
    }>>;
    /** Redis configuration (optional acceleration) */
    redis: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        url: z.ZodOptional<z.ZodString>;
        prefix: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        prefix: string;
        url?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        url?: string | undefined;
        prefix?: string | undefined;
    }>>;
    /** Payload fetcher base URL */
    payloadBaseUrl: z.ZodOptional<z.ZodString>;
    /** Execution mode */
    executionMode: z.ZodDefault<z.ZodEnum<["client", "ssr-embedded", "server-external", "auto"]>>;
    /** Invalidation configuration (optional) */
    invalidation: z.ZodDefault<z.ZodObject<{
        mode: z.ZodDefault<z.ZodEnum<["none", "advisory", "external"]>>;
    }, "strip", z.ZodTypeAny, {
        mode: "none" | "advisory" | "external";
    }, {
        mode?: "none" | "advisory" | "external" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    peers: string[];
    serverId: string;
    port: number;
    host: string;
    cors: {
        origins: string[];
        credentials: boolean;
    };
    rateLimit: {
        enabled: boolean;
        maxRequests: number;
        windowMs: number;
    };
    debug: boolean;
    redis: {
        enabled: boolean;
        prefix: string;
        url?: string | undefined;
    };
    storage: {
        type: "custom" | "memory" | "drizzle" | "prisma" | "sql" | "dynamodb" | "redis";
        tableName: string;
        connectionString?: string | undefined;
    };
    executionMode: "client" | "ssr-embedded" | "server-external" | "auto";
    invalidation: {
        mode: "none" | "advisory" | "external";
    };
    payloadBaseUrl?: string | undefined;
}, {
    serverId: string;
    peers?: string[] | undefined;
    port?: number | undefined;
    host?: string | undefined;
    cors?: {
        origins?: string[] | undefined;
        credentials?: boolean | undefined;
    } | undefined;
    rateLimit?: {
        enabled?: boolean | undefined;
        maxRequests?: number | undefined;
        windowMs?: number | undefined;
    } | undefined;
    debug?: boolean | undefined;
    redis?: {
        enabled?: boolean | undefined;
        url?: string | undefined;
        prefix?: string | undefined;
    } | undefined;
    storage?: {
        type?: "custom" | "memory" | "drizzle" | "prisma" | "sql" | "dynamodb" | "redis" | undefined;
        connectionString?: string | undefined;
        tableName?: string | undefined;
    } | undefined;
    payloadBaseUrl?: string | undefined;
    executionMode?: "client" | "ssr-embedded" | "server-external" | "auto" | undefined;
    invalidation?: {
        mode?: "none" | "advisory" | "external" | undefined;
    } | undefined;
}>;
type ServerConfig = z.input<typeof ServerConfigSchema>;
type ResolvedServerConfig = z.output<typeof ServerConfigSchema>;
interface PeerInfo {
    url: string;
    serverId: string;
    health: PeerHealth;
    maxVersionSeen: number;
    lastSeen: number;
    lastLatency: number;
}
interface MeshState {
    serverId: string;
    maxVersionSeen: number;
    peers: Map<string, PeerInfo>;
    lastGossipTime: number;
}
interface GossipPayload {
    serverId: string;
    maxVersion: number;
    peerSummaries: Array<{
        url: string;
        health: PeerHealth;
        maxVersion: number;
        lastSeen: number;
    }>;
    timestamp: number;
}
declare const GossipPayloadSchema: z.ZodObject<{
    serverId: z.ZodString;
    maxVersion: z.ZodNumber;
    peerSummaries: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        health: z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>;
        maxVersion: z.ZodNumber;
        lastSeen: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lastSeen: number;
        health: "healthy" | "degraded" | "unhealthy" | "unknown";
        url: string;
        maxVersion: number;
    }, {
        lastSeen: number;
        health: "healthy" | "degraded" | "unhealthy" | "unknown";
        url: string;
        maxVersion: number;
    }>, "many">;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    serverId: string;
    maxVersion: number;
    peerSummaries: {
        lastSeen: number;
        health: "healthy" | "degraded" | "unhealthy" | "unknown";
        url: string;
        maxVersion: number;
    }[];
}, {
    timestamp: number;
    serverId: string;
    maxVersion: number;
    peerSummaries: {
        lastSeen: number;
        health: "healthy" | "degraded" | "unhealthy" | "unknown";
        url: string;
        maxVersion: number;
    }[];
}>;
interface InvalidationRequest {
    keys: string[];
    source?: string;
    timestamp?: number;
}
declare const InvalidationRequestSchema: z.ZodObject<{
    keys: z.ZodArray<z.ZodString, "many">;
    source: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    keys: string[];
    timestamp?: number | undefined;
    source?: string | undefined;
}, {
    keys: string[];
    timestamp?: number | undefined;
    source?: string | undefined;
}>;
interface InvalidationResponse {
    invalidated: string[];
    versions: Record<string, number>;
}
interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    serverId: string;
    version: string;
    uptime: number;
    mesh: {
        peerCount: number;
        healthyPeers: number;
    };
    storage: {
        healthy: boolean;
        maxVersion: number;
    };
    redis?: {
        connected: boolean;
    };
}
interface RealityRequest {
    method: string;
    url: string;
    headers: Headers;
    body: unknown;
    params: Record<string, string>;
    query: Record<string, string>;
}
interface RealityResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}
type RealityHandler = (req: RealityRequest) => Promise<RealityResponse>;
type Middleware = (req: RealityRequest, next: () => Promise<RealityResponse>) => Promise<RealityResponse>;
interface StorageFactory {
    create(config: ResolvedServerConfig): Promise<RealityStorage>;
}
interface DatabaseAdapterFactory {
    create(config: ResolvedServerConfig): Promise<DatabaseAdapter>;
}

export { type RealityResponse as A, type ResolvedServerConfig as B, type ChangedNode as C, type DatabaseAdapter as D, ServerConfigSchema as E, type StorageFactory as F, type GossipPayload as G, type HealthResponse as H, type InvalidationConfig as I, type SyncHint as J, SyncHintSchema as K, SyncRequestSchema as L, type MeshInfo as M, SyncResponseSchema as N, type PeerHealth as P, type RealityStorage as R, type ServerConfig as S, type RealityInvalidationAdapter as a, type RealityNodeMeta as b, type SyncRequest as c, type SyncResponse as d, ChangedNodeSchema as e, type DatabaseAdapterFactory as f, GossipPayloadSchema as g, type InvalidationRequest as h, InvalidationRequestSchema as i, type InvalidationResponse as j, MeshInfoSchema as k, type MeshState as l, type Middleware as m, PeerHealthSchema as n, type PeerInfo as o, type PeerSummary as p, PeerSummarySchema as q, type RealityExecutionMode as r, RealityExecutionModeSchema as s, type RealityHandler as t, type RealityMode as u, RealityModeSchema as v, RealityNodeMetaSchema as w, type RealityPersistenceMode as x, RealityPersistenceModeSchema as y, type RealityRequest as z };
