/**
 * @rootlodge/reality - Core Types
 * 
 * Shared type definitions for the Reality socketless real-time system.
 * These types are used by both client and server packages.
 */

import { z } from 'zod';

// ============================================================================
// Reality Mode
// ============================================================================

export const RealityModeSchema = z.enum(['native', 'sse-compat', 'polling-compat']);
export type RealityMode = z.infer<typeof RealityModeSchema>;

// ============================================================================
// Sync Hints
// ============================================================================

export const SyncHintSchema = z.enum(['interaction', 'focus', 'idle', 'mutation', 'mount', 'reconnect', 'poll']);
export type SyncHint = z.infer<typeof SyncHintSchema>;

// ============================================================================
// Reality Node Metadata (Global Invalidation Graph)
// ============================================================================

export const RealityNodeMetaSchema = z.object({
  key: z.string(),
  version: z.number().int().nonnegative(),
  hash: z.string(),
  updatedAt: z.number().int(),
});

export type RealityNodeMeta = z.infer<typeof RealityNodeMetaSchema>;

// ============================================================================
// Peer Summary (Mesh Awareness)
// ============================================================================

export const PeerHealthSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);
export type PeerHealth = z.infer<typeof PeerHealthSchema>;

export const PeerSummarySchema = z.object({
  peer: z.string().url(),
  maxVersionSeen: z.number().int().nonnegative(),
  lastSeen: z.number().int(),
  health: PeerHealthSchema.optional(),
});

export type PeerSummary = z.infer<typeof PeerSummarySchema>;

// ============================================================================
// Client-Server Protocol: Sync Request
// ============================================================================

export const SyncRequestSchema = z.object({
  known: z.record(z.string(), z.number().int().nonnegative()),
  clientId: z.string().uuid(),
  mode: RealityModeSchema,
  hint: SyncHintSchema,
  timestamp: z.number().int().optional(),
  wait: z.number().int().optional(),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

// ============================================================================
// Client-Server Protocol: Sync Response
// ============================================================================

export const ChangedNodeSchema = z.object({
  version: z.number().int().nonnegative(),
  hash: z.string(),
  source: z.string().optional(),
  payload: z.unknown().optional(),
});

export type ChangedNode = z.infer<typeof ChangedNodeSchema>;

export const MeshInfoSchema = z.object({
  peers: z.record(z.string(), PeerHealthSchema),
  serverVersion: z.number().int().nonnegative().optional(),
});

export type MeshInfo = z.infer<typeof MeshInfoSchema>;

export const SyncResponseSchema = z.object({
  changed: z.record(z.string(), ChangedNodeSchema),
  mesh: MeshInfoSchema,
  serverTime: z.number().int(),
});

export type SyncResponse = z.infer<typeof SyncResponseSchema>;

// ============================================================================
// Execution & Persistence Modes
// ============================================================================

/**
 * Persistence mode for Reality
 * - 'none': No database required, in-memory only
 * - 'advisory': Optional DB adapters for invalidation hints
 * - 'external': Application manages its own persistence
 */
export const RealityPersistenceModeSchema = z.enum(['none', 'advisory', 'external']);
export type RealityPersistenceMode = z.infer<typeof RealityPersistenceModeSchema>;

/**
 * Execution mode for Reality
 * - 'client': Browser/client-side, HTTP to external servers
 * - 'ssr-embedded': SSR with in-process server (TanStack/Vite)
 * - 'server-external': Dedicated server mode
 * - 'auto': Automatically detect based on environment
 */
export const RealityExecutionModeSchema = z.enum(['client', 'ssr-embedded', 'server-external', 'auto']);
export type RealityExecutionMode = z.infer<typeof RealityExecutionModeSchema>;

// ============================================================================
// Transport Interface
// ============================================================================

/**
 * Transport abstraction for Reality client
 * Allows switching between HTTP, embedded, or custom transports
 */
export interface RealityTransport {
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

// ============================================================================
// Reality Client Options
// ============================================================================

export const RealityOptionsSchema = z.object({
  /** Base URL(s) of Reality server(s) - optional for embedded mode */
  servers: z.array(z.string().url()).default([]),
  /** Operating mode (compatibility) */
  mode: RealityModeSchema.default('native'),
  /** Execution mode - where Reality runs */
  executionMode: RealityExecutionModeSchema.default('auto'),
  /** Custom transport (overrides executionMode) */
  transport: z.custom<RealityTransport>().optional(),
  /** Client identifier (auto-generated if not provided) */
  clientId: z.string().uuid().optional(),
  /** Initial known versions */
  initialKnown: z.record(z.string(), z.number().int().nonnegative()).optional(),
  /** Request timeout in ms */
  timeout: z.number().int().positive().default(10000),
  /** Max retries per request */
  maxRetries: z.number().int().nonnegative().default(3),
  /** Base delay for exponential backoff in ms */
  retryBaseDelay: z.number().int().positive().default(100),
  /** Server blacklist duration in ms */
  blacklistDuration: z.number().int().positive().default(30000),
  /** Enable debug logging */
  debug: z.boolean().default(false),
});

export type RealityOptions = z.input<typeof RealityOptionsSchema>;
export type ResolvedRealityOptions = z.output<typeof RealityOptionsSchema>;

// ============================================================================
// Reality Key Options
// ============================================================================

export interface RealityKeyOptions<T = unknown> {
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

// ============================================================================
// Reality Node State (Client-side)
// ============================================================================

export type RealityNodeStatus = 'idle' | 'loading' | 'syncing' | 'error' | 'stale';

export interface RealityNodeState<T = unknown> {
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

// ============================================================================
// Mutation Types
// ============================================================================

export interface MutationOptions<T, TInput = unknown> {
  /** Optimistic update function */
  optimisticUpdate?: (current: T | undefined, input: TInput) => T;
  /** Rollback on error */
  rollbackOnError?: boolean;
  /** Invalidate keys after mutation */
  invalidateKeys?: string[];
}

export interface MutationResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
}

// ============================================================================
// Server Configuration
// ============================================================================

export const ServerConfigSchema = z.object({
  /** Server identifier */
  serverId: z.string(),
  /** Peer server URLs */
  peers: z.array(z.string().url()).default([]),
  /** Storage adapter name */
  storage: z.string().default('memory'),
  /** Enable Redis acceleration */
  redis: z.object({
    enabled: z.boolean(),
    url: z.string().optional(),
  }).optional(),
  /** CORS origins */
  corsOrigins: z.array(z.string()).default(['*']),
  /** Rate limiting */
  rateLimit: z.object({
    enabled: z.boolean(),
    maxRequests: z.number().int().positive(),
    windowMs: z.number().int().positive(),
  }).optional(),
});

export type ServerConfig = z.input<typeof ServerConfigSchema>;
export type ResolvedServerConfig = z.output<typeof ServerConfigSchema>;

// ============================================================================
// Storage Interface
// ============================================================================

export interface RealityStorage {
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

// ============================================================================
// Database Adapter Interface
// ============================================================================

export interface DatabaseAdapter {
  /** Fetch payload for a key */
  fetchPayload<T = unknown>(key: string): Promise<T | null>;
  /** Store payload for a key */
  storePayload<T = unknown>(key: string, payload: T): Promise<void>;
  /** Delete payload */
  deletePayload(key: string): Promise<void>;
  /** Batch fetch payloads */
  fetchPayloads<T = unknown>(keys: string[]): Promise<Map<string, T>>;
}

// ============================================================================
// Compatibility Types
// ============================================================================

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface PollingConfig {
  /** Minimum interval between syncs in ms */
  minInterval: number;
  /** Maximum interval between syncs in ms */
  maxInterval: number;
  /** Backoff multiplier on error */
  backoffMultiplier: number;
}

// ============================================================================
// Invalidation Adapter Interface
// ============================================================================

/**
 * Invalidation adapter for advisory database integration
 * Reality does NOT own your data - this is optional!
 */
export interface RealityInvalidationAdapter {
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
export interface InvalidationConfig {
  /** Invalidation adapter instance */
  adapter?: RealityInvalidationAdapter;
  /** Persistence mode */
  mode?: RealityPersistenceMode;
}

// ============================================================================
// Event Types
// ============================================================================

export type RealityEventType = 
  | 'sync:start'
  | 'sync:complete'
  | 'sync:error'
  | 'node:update'
  | 'node:delete'
  | 'mesh:update'
  | 'server:healthy'
  | 'server:unhealthy';

export interface RealityEvent<T = unknown> {
  type: RealityEventType;
  timestamp: number;
  data: T;
}

export type RealityEventHandler<T = unknown> = (event: RealityEvent<T>) => void;

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Awaitable<T> = T | Promise<T>;

export type KeyOf<T> = Extract<keyof T, string>;
