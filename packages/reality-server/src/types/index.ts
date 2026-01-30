/**
 * @rootlodge/reality-server - Server Types
 * 
 * Type definitions for the Reality server.
 * Shared types are duplicated here to avoid circular dependencies.
 */

import { z } from 'zod';

// ============================================================================
// Shared Types (duplicated from @rootlodge/reality for independence)
// ============================================================================

export const RealityModeSchema = z.enum(['native', 'sse-compat', 'polling-compat']);
export type RealityMode = z.infer<typeof RealityModeSchema>;

export const SyncHintSchema = z.enum(['interaction', 'focus', 'idle', 'mutation', 'mount', 'reconnect']);
export type SyncHint = z.infer<typeof SyncHintSchema>;

export const RealityNodeMetaSchema = z.object({
  key: z.string(),
  version: z.number().int().nonnegative(),
  hash: z.string(),
  updatedAt: z.number().int(),
});

export type RealityNodeMeta = z.infer<typeof RealityNodeMetaSchema>;

export const PeerHealthSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);
export type PeerHealth = z.infer<typeof PeerHealthSchema>;

export const PeerSummarySchema = z.object({
  peer: z.string().url(),
  maxVersionSeen: z.number().int().nonnegative(),
  lastSeen: z.number().int(),
  health: PeerHealthSchema.optional(),
});

export type PeerSummary = z.infer<typeof PeerSummarySchema>;

export const SyncRequestSchema = z.object({
  known: z.record(z.string(), z.number().int().nonnegative()),
  clientId: z.string().uuid(),
  mode: RealityModeSchema,
  hint: SyncHintSchema,
  timestamp: z.number().int().optional(),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

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
// Storage Interface (optional - Reality works without it)
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
// Server Configuration
// ============================================================================

export const ServerConfigSchema = z.object({
  /** Server identifier (unique across mesh) */
  serverId: z.string().min(1),
  /** HTTP port to listen on */
  port: z.number().int().positive().default(3000),
  /** Host to bind to */
  host: z.string().default('0.0.0.0'),
  /** Peer server URLs for mesh */
  peers: z.array(z.string().url()).default([]),
  /** CORS configuration */
  cors: z.object({
    origins: z.array(z.string()).default(['*']),
    credentials: z.boolean().default(true),
  }).default({}),
  /** Rate limiting */
  rateLimit: z.object({
    enabled: z.boolean().default(false),
    maxRequests: z.number().int().positive().default(100),
    windowMs: z.number().int().positive().default(60000),
  }).default({}),
  /** Enable debug logging */
  debug: z.boolean().default(false),
  /** Storage configuration */
  storage: z.object({
    type: z.enum(['memory', 'drizzle', 'prisma', 'sql', 'dynamodb', 'redis', 'custom']).default('memory'),
    connectionString: z.string().optional(),
    tableName: z.string().default('reality_nodes'),
  }).default({}),
  /** Redis configuration (optional acceleration) */
  redis: z.object({
    enabled: z.boolean().default(false),
    url: z.string().optional(),
    prefix: z.string().default('reality:'),
  }).default({}),
  /** Payload fetcher base URL */
  payloadBaseUrl: z.string().url().optional(),
  /** Execution mode */
  executionMode: RealityExecutionModeSchema.default('server-external'),
  /** Invalidation configuration (optional) */
  invalidation: z.object({
    mode: RealityPersistenceModeSchema.default('none'),
  }).default({}),
});

export type ServerConfig = z.input<typeof ServerConfigSchema>;
export type ResolvedServerConfig = z.output<typeof ServerConfigSchema>;

// ============================================================================
// Mesh Types
// ============================================================================

export interface PeerInfo {
  url: string;
  serverId: string;
  health: PeerHealth;
  maxVersionSeen: number;
  lastSeen: number;
  lastLatency: number;
}

export interface MeshState {
  serverId: string;
  maxVersionSeen: number;
  peers: Map<string, PeerInfo>;
  lastGossipTime: number;
}

export interface GossipPayload {
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

export const GossipPayloadSchema = z.object({
  serverId: z.string(),
  maxVersion: z.number().int().nonnegative(),
  peerSummaries: z.array(z.object({
    url: z.string().url(),
    health: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
    maxVersion: z.number().int().nonnegative(),
    lastSeen: z.number().int(),
  })),
  timestamp: z.number().int(),
});

// ============================================================================
// Request/Response Types
// ============================================================================

export interface InvalidationRequest {
  keys: string[];
  source?: string;
  timestamp?: number;
}

export const InvalidationRequestSchema = z.object({
  keys: z.array(z.string()).min(1),
  source: z.string().optional(),
  timestamp: z.number().int().optional(),
});

export interface InvalidationResponse {
  invalidated: string[];
  versions: Record<string, number>;
}

export interface HealthResponse {
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

// ============================================================================
// HTTP Handler Types
// ============================================================================

export interface RealityRequest {
  method: string;
  url: string;
  headers: Headers;
  body: unknown;
  params: Record<string, string>;
  query: Record<string, string>;
}

export interface RealityResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type RealityHandler = (req: RealityRequest) => Promise<RealityResponse>;

// ============================================================================
// Middleware Types
// ============================================================================

export type Middleware = (
  req: RealityRequest,
  next: () => Promise<RealityResponse>
) => Promise<RealityResponse>;

// ============================================================================
// Storage Factory Types
// ============================================================================

export interface StorageFactory {
  create(config: ResolvedServerConfig): Promise<RealityStorage>;
}

// ============================================================================
// Database Adapter Factory Types
// ============================================================================

export interface DatabaseAdapterFactory {
  create(config: ResolvedServerConfig): Promise<DatabaseAdapter>;
}
