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

import type {
  ServerConfig,
  ResolvedServerConfig,
  RealityStorage,
  RealityNodeMeta,
  RealityInvalidationAdapter,
} from './types';
import { ServerConfigSchema } from './types';
import { MemoryStorage } from './storage/memory';
import { MeshCoordinator, createMeshCoordinator } from './mesh/coordinator';
import { RedisAccelerator } from './redis/accelerator';
import { createFetchHandler } from './http/fetch';
import type { HandlerDeps } from './http/handlers';

import { EventEmitter } from 'events';



/**
 * Reality Server options after resolution
 */
interface RealityServerComponents {
  config: ResolvedServerConfig;
  storage: RealityStorage;
  mesh: MeshCoordinator;
  redis?: RedisAccelerator;
  invalidationAdapter?: RealityInvalidationAdapter;
  startTime: number;
}

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
export class RealityServer {
  private components: RealityServerComponents;
  private handlerDeps: HandlerDeps;

  constructor(config: ServerConfig, customStorage?: RealityStorage) {
    // Validate and resolve config
    const parsed = ServerConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(`Invalid server config: ${parsed.error.message}`);
    }

    const resolvedConfig = parsed.data;

    // Initialize storage (optional - defaults to memory)
    const storage = customStorage ?? new MemoryStorage();

    // Initialize mesh coordinator
    const mesh = createMeshCoordinator({
      serverId: resolvedConfig.serverId,
      peers: resolvedConfig.peers,
      debug: resolvedConfig.debug,
    });

    this.components = {
      config: resolvedConfig,
      storage,
      mesh,
      startTime: Date.now(),
    };

    // Build handler dependencies
    this.handlerDeps = {
      storage: this.components.storage,
      mesh: this.components.mesh,
      redis: this.components.redis,
      serverId: resolvedConfig.serverId,
      version: '1.0.0',
      startTime: this.components.startTime,
      debug: resolvedConfig.debug,
      events: new EventEmitter(),
    };
  }

  /**
   * Invalidate a single key
   * Call this when your data changes - Reality will propagate the invalidation.
   * 
   * @param key - The key to invalidate (e.g., 'chat:room:123')
   */
  async invalidate(key: string): Promise<void> {
    return this.invalidateMany([key]);
  }

  /**
   * Invalidate multiple keys at once
   * More efficient than calling invalidate() multiple times.
   * 
   * @param keys - Array of keys to invalidate
   */
  async invalidateMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.components.storage.incrementVersion(key, '');
    }
    
    // Update mesh
    const maxVersion = await this.components.storage.getMaxVersion();
    this.components.mesh.updateMaxVersion(maxVersion);

    // Propagate via Redis if available
    if (this.components.redis?.isConnected()) {
      for (const key of keys) {
        await this.components.redis.invalidateCache(key);
      }
      await this.components.redis.publishInvalidation(keys);
    }

    // Propagate to mesh peers
    this.components.mesh.propagateInvalidation(keys);
    
    // Notify invalidation adapter if configured
    if (this.components.invalidationAdapter) {
      await this.components.invalidationAdapter.onInvalidate(keys);
    }
  }

  /**
   * Set invalidation adapter for database integration
   */
  setInvalidationAdapter(adapter: RealityInvalidationAdapter): void {
    this.components.invalidationAdapter = adapter;
  }

  /**
   * Set custom storage adapter
   */
  setStorage(storage: RealityStorage): void {
    this.components.storage = storage;
    this.handlerDeps.storage = storage;
  }

  /**
   * Set Redis accelerator
   */
  setRedis(redis: RedisAccelerator): void {
    this.components.redis = redis;
    this.handlerDeps.redis = redis;
  }

  /**
   * Set payload fetcher for inline payloads
   */
  setPayloadFetcher(fetcher: (key: string) => Promise<unknown>): void {
    this.handlerDeps.payloadFetcher = fetcher;
  }

  /**
   * Get the Fetch API handler
   */
  getFetchHandler(basePath = '/reality'): (request: Request) => Promise<Response> {
    return createFetchHandler(this.handlerDeps, {
      basePath,
      corsOrigins: this.components.config.cors.origins,
    });
  }

  /**
   * Get handler dependencies for custom integrations
   */
  getHandlerDeps(): HandlerDeps {
    return { ...this.handlerDeps };
  }

  /**
   * Get storage instance
   */
  getStorage(): RealityStorage {
    return this.components.storage;
  }

  /**
   * Get mesh coordinator
   */
  getMesh(): MeshCoordinator {
    return this.components.mesh;
  }

  /**
   * Get Redis accelerator if configured
   */
  getRedis(): RedisAccelerator | undefined {
    return this.components.redis;
  }

  /**
   * Update a node's version (call this when your data changes)
   * 
   * @param key - The node key
   * @param hash - Hash of the new data
   * @returns Updated node metadata
   */
  async updateNode(key: string, hash: string): Promise<RealityNodeMeta> {
    const meta = await this.components.storage.incrementVersion(key, hash);
    
    // Update mesh
    this.components.mesh.updateMaxVersion(meta.version);

    // Propagate via Redis if available
    if (this.components.redis?.isConnected()) {
      await this.components.redis.invalidateCache(key);
      await this.components.redis.publishInvalidation([key]);
    }

    // Propagate to mesh peers
    this.components.mesh.propagateInvalidation([key]);

    return meta;
  }

  /**
   * Get node metadata
   */
  async getNode(key: string): Promise<RealityNodeMeta | null> {
    return this.components.storage.getNode(key);
  }

  /**
   * Delete a node
   */
  async deleteNode(key: string): Promise<void> {
    await this.components.storage.deleteNode(key);

    // Propagate invalidation
    if (this.components.redis?.isConnected()) {
      await this.components.redis.invalidateCache(key);
      await this.components.redis.publishInvalidation([key]);
    }

    this.components.mesh.propagateInvalidation([key]);
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      serverId: this.components.config.serverId,
      uptime: Date.now() - this.components.startTime,
      mesh: this.components.mesh.getStats(),
      redis: this.components.redis?.getStats(),
    };
  }
}

/**
 * Create a Reality server instance
 */
export function createRealityServer(config: ServerConfig, storage?: RealityStorage): RealityServer {
  return new RealityServer(config, storage);
}
