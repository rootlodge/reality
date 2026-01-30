/**
 * @rootlodge/reality-server - Server Types
 * 
 * Type definitions for the Reality server.
 */

import { z } from 'zod';
import type {
  RealityNodeMeta,
  SyncRequest,
  SyncResponse,
  PeerHealth,
  RealityStorage,
  DatabaseAdapter,
} from '@rootlodge/reality';

// Re-export client types used by server
export type {
  RealityNodeMeta,
  SyncRequest,
  SyncResponse,
  PeerHealth,
  RealityStorage,
  DatabaseAdapter,
};

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
