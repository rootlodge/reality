/**
 * @rootlodge/reality - Sync Engine
 * 
 * Core synchronization logic for the Reality client.
 * Handles batching, deduplication, and state reconciliation.
 */

import type {
  RealityNodeMeta,
  RealityNodeState,
  SyncRequest,
  SyncResponse,
  SyncHint,
  RealityMode,
  RealityEventType,
  RealityEvent,
  RealityEventHandler,
  RealityKeyOptions,
  RealityTransport,
} from '../types';
import { now, debounce } from '../utils/time';
import { hashEquals } from '../utils/hash';

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
 * Internal node state with additional tracking
 */
interface InternalNodeState<T = unknown> extends RealityNodeState<T> {
  options: RealityKeyOptions<T>;
  subscribers: Set<SubscriptionCallback<T>>;
  pendingFetch: Promise<T> | null;
  optimisticData: T | undefined;
  rollbackData: T | undefined;
}

/**
 * Sync Engine - manages all Reality node states
 */
export class SyncEngine {
  private config: SyncEngineConfig;
  private nodes: Map<string, InternalNodeState> = new Map();
  private known: Map<string, number> = new Map();
  private eventHandlers: Map<RealityEventType, Set<RealityEventHandler>> = new Map();
  private pendingSync: Set<string> = new Set();
  private debouncedSync: () => void;
  private isSyncing = false;
  private lastSyncTime = 0;

  constructor(config: SyncEngineConfig) {
    this.config = config;
    this.debouncedSync = debounce(() => this.performSync('idle'), config.batchDelay ?? 50);
  }

  /**
   * Subscribe to a Reality node
   */
  subscribe<T>(
    key: string,
    callback: SubscriptionCallback<T>,
    options: RealityKeyOptions<T> = {}
  ): () => void {
    let node = this.nodes.get(key) as InternalNodeState<T> | undefined;

    if (!node) {
      node = this.createNode<T>(key, options);
      this.nodes.set(key, node as InternalNodeState);
    }

    node.subscribers.add(callback as SubscriptionCallback);

    // Immediately notify with current state
    callback(this.getPublicState(node));

    // Schedule sync if needed
    if (node.status === 'idle' || node.isStale) {
      this.scheduleSync(key);
    }

    // Return unsubscribe function
    return () => {
      node!.subscribers.delete(callback as SubscriptionCallback);
      
      // Clean up node if no more subscribers
      if (node!.subscribers.size === 0) {
        this.nodes.delete(key);
        this.known.delete(key);
      }
    };
  }

  /**
   * Get current state of a node
   */
  getState<T>(key: string): RealityNodeState<T> | null {
    const node = this.nodes.get(key) as InternalNodeState<T> | undefined;
    return node ? this.getPublicState(node) : null;
  }

  /**
   * Trigger a sync for specific keys
   */
  async syncKeys(keys: string[], hint: SyncHint = 'interaction'): Promise<void> {
    for (const key of keys) {
      this.pendingSync.add(key);
    }
    await this.performSync(hint);
  }

  /**
   * Trigger a sync for all subscribed keys
   */
  async syncAll(hint: SyncHint = 'interaction'): Promise<void> {
    for (const key of this.nodes.keys()) {
      this.pendingSync.add(key);
    }
    await this.performSync(hint);
  }

  /**
   * Apply optimistic update
   */
  applyOptimisticUpdate<T>(
    key: string,
    update: (current: T | undefined) => T
  ): () => void {
    const node = this.nodes.get(key) as InternalNodeState<T> | undefined;
    if (!node) {
      throw new Error(`Node ${key} not found`);
    }

    // Store rollback data
    node.rollbackData = node.data;
    
    // Apply optimistic update
    node.optimisticData = update(node.data);
    node.data = node.optimisticData;

    // Notify subscribers
    this.notifySubscribers(node);

    // Return rollback function
    return () => {
      if (node.rollbackData !== undefined) {
        node.data = node.rollbackData;
        node.optimisticData = undefined;
        node.rollbackData = undefined;
        this.notifySubscribers(node);
      }
    };
  }

  /**
   * Clear optimistic state after server confirms
   */
  clearOptimistic(key: string): void {
    const node = this.nodes.get(key);
    if (node) {
      node.optimisticData = undefined;
      node.rollbackData = undefined;
    }
  }

  /**
   * Add event handler
   */
  on<T = unknown>(type: RealityEventType, handler: RealityEventHandler<T>): () => void {
    let handlers = this.eventHandlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(type, handlers);
    }
    handlers.add(handler as RealityEventHandler);

    return () => {
      handlers!.delete(handler as RealityEventHandler);
    };
  }

  /**
   * Emit event
   */
  private emit<T>(type: RealityEventType, data: T): void {
    const event: RealityEvent<T> = {
      type,
      timestamp: now(),
      data,
    };

    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          if (this.config.debug) {
            console.error(`[Reality] Event handler error:`, error);
          }
        }
      }
    }
  }

  /**
   * Create a new internal node state
   */
  private createNode<T>(key: string, options: RealityKeyOptions<T>): InternalNodeState<T> {
    return {
      key,
      data: options.fallback,
      meta: null,
      status: 'idle',
      error: null,
      isLoading: false,
      isSyncing: false,
      isStale: true,
      lastSyncAt: null,
      options,
      subscribers: new Set(),
      pendingFetch: null,
      optimisticData: undefined,
      rollbackData: undefined,
    };
  }

  /**
   * Convert internal state to public state
   */
  private getPublicState<T>(node: InternalNodeState<T>): RealityNodeState<T> {
    return {
      key: node.key,
      data: node.optimisticData ?? node.data,
      meta: node.meta,
      status: node.status,
      error: node.error,
      isLoading: node.isLoading,
      isSyncing: node.isSyncing,
      isStale: node.isStale,
      lastSyncAt: node.lastSyncAt,
    };
  }

  /**
   * Schedule a sync operation
   */
  private scheduleSync(key: string): void {
    this.pendingSync.add(key);
    this.debouncedSync();
  }

  /**
   * Perform sync with server
   */
  private async performSync(hint: SyncHint): Promise<void> {
    if (this.isSyncing) return;
    if (this.pendingSync.size === 0) return;

    this.isSyncing = true;
    
    // Get keys to sync and clear pending set
    const keysToSync = Array.from(this.pendingSync);
    this.pendingSync.clear();

    // Build known versions map for keys we're syncing
    const knownVersions: Record<string, number> = {};
    for (const key of keysToSync) {
      const version = this.known.get(key);
      if (version !== undefined) {
        knownVersions[key] = version;
      } else {
        knownVersions[key] = 0;
      }
    }

    // Mark nodes as syncing
    for (const key of keysToSync) {
      const node = this.nodes.get(key);
      if (node) {
        node.isSyncing = true;
        this.notifySubscribers(node);
      }
    }

    this.emit('sync:start', { keys: keysToSync, hint });

    try {
      const request: SyncRequest = {
        known: knownVersions,
        clientId: this.config.clientId,
        mode: this.config.mode,
        hint,
        timestamp: now(),
        wait: hint === 'poll' ? 25000 : undefined,
      };

      const response = await this.config.transport.sync(request);
      await this.reconcileResponse(response, keysToSync);
      
      this.lastSyncTime = now();
      this.emit('sync:complete', { keys: keysToSync, response });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Mark nodes as error
      for (const key of keysToSync) {
        const node = this.nodes.get(key);
        if (node) {
          node.status = 'error';
          node.error = err;
          node.isSyncing = false;
          this.notifySubscribers(node);
        }
      }

      this.emit('sync:error', { keys: keysToSync, error: err });
      
      if (this.config.debug) {
        console.error(`[Reality] Sync error:`, err);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Reconcile server response with local state
   */
  private async reconcileResponse(response: SyncResponse, keysToSync: string[]): Promise<void> {
    // Process mesh updates
    this.emit('mesh:update', response.mesh);

    // Process changed nodes
    for (const [key, change] of Object.entries(response.changed)) {
      const node = this.nodes.get(key);
      if (!node) continue;

      const currentVersion = this.known.get(key) ?? 0;
      
      // Update if version is different (handle upgrades and resets)
      if (change.version !== currentVersion) {
        this.known.set(key, change.version);
        
        const oldMeta = node.meta;
        node.meta = {
          key,
          version: change.version,
          hash: change.hash,
          updatedAt: response.serverTime,
        };

        // Check if hash changed (actual data change)
        const hashChanged = !oldMeta || !hashEquals(oldMeta.hash, change.hash);
        
        if (hashChanged) {
          // Fetch new payload
          await this.fetchPayload(node, change.payload);
        }

        node.status = 'idle';
        node.error = null;
        node.isSyncing = false;
        node.isStale = false;
        node.lastSyncAt = now();

        this.emit('node:update', { key, meta: node.meta, data: node.data });
      } else {
        // No change needed
        node.isSyncing = false;
        node.isStale = false;
        node.lastSyncAt = now();
      }

      this.notifySubscribers(node);
    }

    // Mark non-changed keys as synced
    for (const key of keysToSync) {
      if (!(key in response.changed)) {
        const node = this.nodes.get(key);
        if (node) {
          node.isSyncing = false;
          node.isStale = false;
          node.lastSyncAt = now();
          this.notifySubscribers(node);
        }
      }
    }
  }

  /**
   * Fetch payload for a node
   */
  private async fetchPayload<T>(node: InternalNodeState<T>, inlinePayload?: unknown): Promise<void> {
    // If payload was included in sync response, use it
    if (inlinePayload !== undefined) {
      node.data = this.transformPayload(node, inlinePayload);
      return;
    }

    // Otherwise, fetch using configured fetcher
    const fetcher = node.options.fetcher ?? this.config.defaultFetcher;
    
    if (!fetcher || !node.meta) {
      return;
    }

    // Avoid duplicate fetches
    if (node.pendingFetch) {
      return;
    }

    node.isLoading = true;
    node.status = 'loading';
    this.notifySubscribers(node);

    try {
      node.pendingFetch = fetcher(node.key, node.meta) as Promise<T>;
      const payload = await node.pendingFetch;
      
      // Only update if this is still the current version
      if (node.meta && node.meta.version === this.known.get(node.key)) {
        node.data = this.transformPayload(node, payload);
      }
    } catch (error) {
      node.error = error instanceof Error ? error : new Error(String(error));
      node.status = 'error';
      
      if (this.config.debug) {
        console.error(`[Reality] Payload fetch error for ${node.key}:`, error);
      }
    } finally {
      node.isLoading = false;
      node.pendingFetch = null;
      this.notifySubscribers(node);
    }
  }

  /**
   * Transform payload using node options
   */
  private transformPayload<T>(node: InternalNodeState<T>, payload: unknown): T {
    // Validate if schema provided
    if (node.options.schema) {
      const result = node.options.schema.safeParse(payload);
      if (!result.success) {
        throw new Error(`Validation failed: ${result.error.message}`);
      }
      return result.data;
    }

    // Transform if transformer provided
    if (node.options.transform) {
      return node.options.transform(payload);
    }

    return payload as T;
  }

  /**
   * Notify all subscribers of a node
   */
  private notifySubscribers<T>(node: InternalNodeState<T>): void {
    const publicState = this.getPublicState(node);
    for (const callback of node.subscribers) {
      try {
        callback(publicState);
      } catch (error) {
        if (this.config.debug) {
          console.error(`[Reality] Subscriber error for ${node.key}:`, error);
        }
      }
    }
  }

  /**
   * Get all known versions
   */
  getKnownVersions(): Map<string, number> {
    return new Map(this.known);
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    subscribedKeys: number;
    lastSyncTime: number;
    isSyncing: boolean;
  } {
    return {
      subscribedKeys: this.nodes.size,
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Destroy the sync engine
   */
  destroy(): void {
    this.nodes.clear();
    this.known.clear();
    this.eventHandlers.clear();
    this.pendingSync.clear();
  }
}
