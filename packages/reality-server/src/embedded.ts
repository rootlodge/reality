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

import type {
  SyncRequest,
  SyncResponse,
  RealityNodeMeta,
  RealityStorage,
  ChangedNode,
  PeerHealth,
  RealityInvalidationAdapter,
  InvalidationConfig,
} from './types';
import { MemoryStorage } from './storage/memory';
import { MeshCoordinator, createMeshCoordinator } from './mesh/coordinator';
import type { HandlerDeps } from './http/handlers';

/**
 * Embedded server configuration
 */
export interface EmbeddedServerConfig {
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
export class EmbeddedRealityServer {
  private config: Required<Omit<EmbeddedServerConfig, 'invalidation'>> & { invalidation?: InvalidationConfig };
  private storage: RealityStorage;
  private mesh: MeshCoordinator;
  private invalidationAdapter?: RealityInvalidationAdapter;
  private startTime: number;

  constructor(config: EmbeddedServerConfig = {}) {
    this.config = {
      serverId: config.serverId ?? `embedded-${Date.now().toString(36)}`,
      storage: config.storage ?? new MemoryStorage(),
      invalidation: config.invalidation,
      peers: config.peers ?? [],
      debug: config.debug ?? false,
    };
    
    this.storage = this.config.storage;
    this.invalidationAdapter = config.invalidation?.adapter;
    this.startTime = Date.now();

    // Initialize mesh coordinator
    this.mesh = createMeshCoordinator({
      serverId: this.config.serverId,
      peers: this.config.peers,
      debug: this.config.debug,
    });
  }

  /**
   * Get server ID
   */
  getServerId(): string {
    return this.config.serverId;
  }

  /**
   * Handle a sync request directly (no HTTP)
   */
  async handleSync(request: SyncRequest): Promise<SyncResponse> {
    const keys = Object.keys(request.known);
    const nodeMetas = await this.storage.getNodes(keys);
    
    const changed: Record<string, ChangedNode> = {};
    
    for (const [key, clientVersion] of Object.entries(request.known)) {
      const meta = nodeMetas.get(key);
      
      if (!meta) {
        // Key doesn't exist on server
        changed[key] = {
          version: 0,
          hash: '',
          source: this.config.serverId,
        };
        continue;
      }
      
      if (meta.version > clientVersion) {
        changed[key] = {
          version: meta.version,
          hash: meta.hash,
          source: this.config.serverId,
        };
      }
    }
    
    const maxVersion = await this.storage.getMaxVersion();
    
    return {
      changed,
      mesh: {
        peers: this.mesh.getPeerHealthMap() as Record<string, PeerHealth>,
        serverVersion: maxVersion,
      },
      serverTime: Date.now(),
    };
  }

  /**
   * Invalidate keys
   */
  async invalidate(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.storage.incrementVersion(key, '');
    }
    
    // Notify invalidation adapter if configured
    if (this.invalidationAdapter) {
      await this.invalidationAdapter.onInvalidate(keys);
    }
    
    // Update mesh
    const maxVersion = await this.storage.getMaxVersion();
    this.mesh.updateMaxVersion(maxVersion);
  }

  /**
   * Invalidate many keys at once
   */
  async invalidateMany(keys: string[]): Promise<void> {
    return this.invalidate(keys);
  }

  /**
   * Get node metadata
   */
  async getNode(key: string): Promise<RealityNodeMeta | null> {
    return this.storage.getNode(key);
  }

  /**
   * Update a node's version
   */
  async updateNode(key: string, hash: string): Promise<RealityNodeMeta> {
    const meta = await this.storage.incrementVersion(key, hash);
    this.mesh.updateMaxVersion(meta.version);
    
    // Notify invalidation adapter
    if (this.invalidationAdapter) {
      await this.invalidationAdapter.onInvalidate([key]);
    }
    
    return meta;
  }

  /**
   * Get storage instance
   */
  getStorage(): RealityStorage {
    return this.storage;
  }

  /**
   * Set storage adapter
   */
  setStorage(storage: RealityStorage): void {
    this.storage = storage;
    this.config.storage = storage;
  }

  /**
   * Set invalidation adapter
   */
  setInvalidationAdapter(adapter: RealityInvalidationAdapter): void {
    this.invalidationAdapter = adapter;
  }

  /**
   * Get handler dependencies for custom integrations
   */
  getHandlerDeps(): HandlerDeps {
    return {
      storage: this.storage,
      mesh: this.mesh,
      serverId: this.config.serverId,
      version: '1.0.0',
      startTime: this.startTime,
      debug: this.config.debug,
    };
  }

  /**
   * Get mesh coordinator
   */
  getMesh(): MeshCoordinator {
    return this.mesh;
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      serverId: this.config.serverId,
      uptime: Date.now() - this.startTime,
      mode: 'embedded',
      mesh: this.mesh.getStats(),
    };
  }
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
export function createEmbeddedRealityServer(config: EmbeddedServerConfig = {}): EmbeddedRealityServer {
  return new EmbeddedRealityServer(config);
}

/**
 * Shared embedded server instance for SSR
 * Use this when you want to share state across requests
 */
let sharedEmbeddedServer: EmbeddedRealityServer | null = null;

/**
 * Get or create a shared embedded server instance
 */
export function getSharedEmbeddedServer(config?: EmbeddedServerConfig): EmbeddedRealityServer {
  if (!sharedEmbeddedServer) {
    sharedEmbeddedServer = createEmbeddedRealityServer(config);
  }
  return sharedEmbeddedServer;
}

/**
 * Reset the shared embedded server (useful for testing)
 */
export function resetSharedEmbeddedServer(): void {
  sharedEmbeddedServer = null;
}
