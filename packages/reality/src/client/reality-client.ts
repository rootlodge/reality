/**
 * @rootlodge/reality - Reality Client
 * 
 * Main client class for the Reality system.
 * Provides the core API for subscribing to real-time data.
 */

import type {
  RealityOptions,
  ResolvedRealityOptions,
  RealityKeyOptions,
  RealityNodeState,
  RealityNodeMeta,
  SyncHint,
  RealityEventType,
  RealityEventHandler,
  MutationOptions,
} from '../types';
import { RealityOptionsSchema } from '../types';
import { RealityTransport } from '../transport/transport';
import { SyncEngine } from './sync-engine';
import { generateUUID } from '../utils/uuid';
import { now } from '../utils/time';
import { createHash } from '../utils/hash';

/**
 * Visibility and focus tracking for intelligent sync triggers
 */
interface VisibilityState {
  isVisible: boolean;
  isFocused: boolean;
  lastVisibleAt: number;
  lastFocusAt: number;
}

/**
 * Reality Client - Main entry point for the Reality system
 */
export class RealityClient {
  private options: ResolvedRealityOptions;
  private transport: RealityTransport;
  private syncEngine: SyncEngine;
  private visibility: VisibilityState;
  private cleanupFns: (() => void)[] = [];
  private defaultFetcher?: (key: string, meta: RealityNodeMeta) => Promise<unknown>;

  constructor(options: RealityOptions) {
    // Validate and resolve options
    const parsed = RealityOptionsSchema.safeParse(options);
    if (!parsed.success) {
      throw new Error(`Invalid Reality options: ${parsed.error.message}`);
    }
    
    this.options = {
      ...parsed.data,
      clientId: parsed.data.clientId ?? generateUUID(),
    };

    // Initialize transport
    this.transport = new RealityTransport(this.options);

    // Initialize sync engine
    this.syncEngine = new SyncEngine({
      clientId: this.options.clientId!,
      mode: this.options.mode,
      transport: this.transport,
      debug: this.options.debug,
      defaultFetcher: this.defaultFetcher,
    });

    // Initialize visibility state
    this.visibility = {
      isVisible: true,
      isFocused: true,
      lastVisibleAt: now(),
      lastFocusAt: now(),
    };

    // Set up event listeners for browser/RN environments
    this.setupEventListeners();
  }

  /**
   * Subscribe to a Reality node
   * 
   * @param key - The key identifying the reality node
   * @param options - Configuration options for this subscription
   * @returns Unsubscribe function
   */
  subscribe<T>(
    key: string,
    callback: (state: RealityNodeState<T>) => void,
    options: RealityKeyOptions<T> = {}
  ): () => void {
    return this.syncEngine.subscribe(key, callback, options);
  }

  /**
   * Get current state of a Reality node
   */
  getState<T>(key: string): RealityNodeState<T> | null {
    return this.syncEngine.getState(key);
  }

  /**
   * Create a realtime subscription helper
   * 
   * @param key - The key identifying the reality node
   * @param options - Configuration options
   * @returns Object with subscribe method and state accessor
   */
  realtime<T>(key: string, options: RealityKeyOptions<T> = {}) {
    return {
      subscribe: (callback: (state: RealityNodeState<T>) => void) => {
        return this.subscribe(key, callback, options);
      },
      getState: () => this.getState<T>(key),
      sync: (hint: SyncHint = 'interaction') => this.syncKeys([key], hint),
    };
  }

  /**
   * Sync specific keys with the server
   */
  async syncKeys(keys: string[], hint: SyncHint = 'interaction'): Promise<void> {
    return this.syncEngine.syncKeys(keys, hint);
  }

  /**
   * Sync all subscribed keys
   */
  async syncAll(hint: SyncHint = 'interaction'): Promise<void> {
    return this.syncEngine.syncAll(hint);
  }

  /**
   * Perform a mutation with optimistic update
   */
  async mutate<T, TInput = unknown>(
    key: string,
    input: TInput,
    mutationFn: (input: TInput) => Promise<T>,
    options: MutationOptions<T, TInput> = {}
  ): Promise<T> {
    let rollback: (() => void) | null = null;

    // Apply optimistic update if provided
    if (options.optimisticUpdate) {
      const state = this.getState<T>(key);
      rollback = this.syncEngine.applyOptimisticUpdate<T>(
        key,
        (current) => options.optimisticUpdate!(current, input)
      );
    }

    try {
      // Perform the actual mutation
      const result = await mutationFn(input);
      
      // Clear optimistic state
      this.syncEngine.clearOptimistic(key);
      
      // Sync to get authoritative state
      await this.syncKeys([key], 'mutation');
      
      // Invalidate related keys if specified
      if (options.invalidateKeys && options.invalidateKeys.length > 0) {
        await this.syncKeys(options.invalidateKeys, 'mutation');
      }

      return result;
    } catch (error) {
      // Rollback optimistic update on error
      if (rollback && options.rollbackOnError !== false) {
        rollback();
      }
      throw error;
    }
  }

  /**
   * Invalidate keys (mark as stale and trigger sync)
   */
  async invalidate(keys: string[]): Promise<void> {
    return this.syncKeys(keys, 'mutation');
  }

  /**
   * Add event listener
   */
  on<T = unknown>(event: RealityEventType, handler: RealityEventHandler<T>): () => void {
    return this.syncEngine.on(event, handler);
  }

  /**
   * Set default fetcher for payloads
   */
  setDefaultFetcher(fetcher: (key: string, meta: RealityNodeMeta) => Promise<unknown>): void {
    this.defaultFetcher = fetcher;
  }

  /**
   * Get client ID
   */
  getClientId(): string {
    return this.options.clientId!;
  }

  /**
   * Get current mode
   */
  getMode() {
    return this.options.mode;
  }

  /**
   * Get server status
   */
  getServerStatus() {
    return this.transport.getServerStatus();
  }

  /**
   * Get sync statistics
   */
  getStats() {
    return this.syncEngine.getStats();
  }

  /**
   * Check if client is visible (browser/RN)
   */
  isVisible(): boolean {
    return this.visibility.isVisible;
  }

  /**
   * Check if client is focused (browser/RN)
   */
  isFocused(): boolean {
    return this.visibility.isFocused;
  }

  /**
   * Set up visibility and focus event listeners
   */
  private setupEventListeners(): void {
    // Browser environment
    if (typeof document !== 'undefined') {
      const handleVisibilityChange = () => {
        const isVisible = document.visibilityState === 'visible';
        if (isVisible && !this.visibility.isVisible) {
          // Became visible - trigger sync
          this.visibility.lastVisibleAt = now();
          this.syncAll('focus');
        }
        this.visibility.isVisible = isVisible;
      };

      const handleFocus = () => {
        if (!this.visibility.isFocused) {
          this.visibility.lastFocusAt = now();
          this.syncAll('focus');
        }
        this.visibility.isFocused = true;
      };

      const handleBlur = () => {
        this.visibility.isFocused = false;
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      this.cleanupFns.push(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
      });
    }

    // React Native environment (AppState)
    if (typeof global !== 'undefined' && (global as Record<string, unknown>).AppState) {
      const AppState = (global as Record<string, unknown>).AppState as {
        addEventListener: (event: string, handler: (state: string) => void) => { remove: () => void };
      };
      
      const subscription = AppState.addEventListener('change', (state: string) => {
        const isActive = state === 'active';
        if (isActive && !this.visibility.isVisible) {
          this.visibility.lastVisibleAt = now();
          this.syncAll('focus');
        }
        this.visibility.isVisible = isActive;
        this.visibility.isFocused = isActive;
      });

      this.cleanupFns.push(() => subscription.remove());
    }

    // Online/offline handling
    if (typeof window !== 'undefined' && 'navigator' in window) {
      const handleOnline = () => {
        this.transport.clearAllBlacklists();
        this.syncAll('reconnect');
      };

      window.addEventListener('online', handleOnline);
      this.cleanupFns.push(() => window.removeEventListener('online', handleOnline));
    }
  }

  /**
   * Destroy the client and clean up resources
   */
  destroy(): void {
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
    this.syncEngine.destroy();
  }
}

/**
 * Create a Reality client instance
 */
export function createRealityClient(options: RealityOptions): RealityClient {
  return new RealityClient(options);
}
