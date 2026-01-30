/**
 * @rootlodge/reality - Polling Compatibility Layer
 * 
 * Drop-in replacement for setInterval-based polling that uses Reality.
 * Eliminates wasteful periodic network requests.
 */

import type { RealityKeyOptions, RealityNodeState, SyncHint } from '../types';
import { RealityClient } from '../client/reality-client';
import { now } from '../utils/time';

/**
 * Callback for polling adapter
 */
export type PollingCallback<T = unknown> = (data: T) => void;

/**
 * Options for polling adapter
 */
export interface PollingAdapterOptions<T = unknown> {
  /** Reality key to subscribe to */
  realityKey?: string;
  /** Transform data before passing to callback */
  transform?: (data: unknown) => T;
  /** Validation schema (zod) */
  schema?: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown } };
  /** Initial data / fallback */
  initial?: T;
  /** Sync on visibility change */
  syncOnVisibility?: boolean;
  /** Sync on focus */
  syncOnFocus?: boolean;
  /** Sync on interaction hint */
  syncOnInteraction?: boolean;
}

/**
 * Polling adapter control object
 */
export interface PollingAdapterControl {
  /** Manually trigger a sync */
  sync: (hint?: SyncHint) => Promise<void>;
  /** Stop the adapter */
  stop: () => void;
  /** Check if adapter is active */
  isActive: () => boolean;
  /** Get last sync timestamp */
  getLastSyncTime: () => number | null;
}

/**
 * Create a polling adapter that uses Reality instead of setInterval
 * 
 * This is the primary migration helper for polling-based applications.
 * Instead of making periodic requests, it syncs only when meaningful:
 * - User interaction
 * - Window focus/visibility
 * - Optimistic mutations
 * - Idle callbacks
 * 
 * @param url - The original polling endpoint (used as key basis)
 * @param callback - Function to call with updates (same as polling callback)
 * @param client - Reality client instance
 * @param options - Configuration options
 * @returns Control object for the adapter
 * 
 * @example
 * ```typescript
 * // BEFORE (wasteful polling):
 * setInterval(async () => {
 *   const data = await fetch('/updates').then(r => r.json());
 *   updateUI(data);
 * }, 1000);
 * 
 * // AFTER (Reality):
 * const client = createRealityClient({ servers: ['https://api.example.com'] });
 * const adapter = createPollingAdapter('/updates', updateUI, client);
 * 
 * // Optionally trigger manual sync:
 * document.getElementById('refresh').onclick = () => adapter.sync();
 * 
 * // Cleanup when done:
 * adapter.stop();
 * ```
 */
export function createPollingAdapter<T = unknown>(
  url: string,
  callback: PollingCallback<T>,
  client: RealityClient,
  options: PollingAdapterOptions<T> = {}
): PollingAdapterControl {
  const realityKey = options.realityKey ?? urlToKey(url);
  let isActive = true;
  let lastSyncTime: number | null = null;
  let unsubscribe: (() => void) | null = null;

  // Build Reality options
  const keyOptions: RealityKeyOptions<T> = {
    fallback: options.initial,
    transform: options.transform,
    refetchOnFocus: options.syncOnFocus ?? true,
    refetchOnReconnect: true,
  };

  // Subscribe to Reality
  unsubscribe = client.subscribe<T>(
    realityKey,
    (state: RealityNodeState<T>) => {
      if (!isActive) return;

      // Update last sync time
      if (state.lastSyncAt) {
        lastSyncTime = state.lastSyncAt;
      }

      // Only call callback with actual data
      if (state.data !== undefined && !state.isLoading && !state.error) {
        callback(state.data);
      }
    },
    keyOptions
  );

  // Set up visibility-based sync
  if (options.syncOnVisibility !== false && typeof document !== 'undefined') {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive) {
        client.syncKeys([realityKey], 'focus');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // Return control object
  return {
    sync: async (hint: SyncHint = 'interaction') => {
      if (isActive) {
        await client.syncKeys([realityKey], hint);
      }
    },
    stop: () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
    isActive: () => isActive,
    getLastSyncTime: () => lastSyncTime,
  };
}

/**
 * Create a batch polling adapter for multiple endpoints
 * 
 * Useful when migrating apps that poll multiple endpoints.
 * All endpoints are batched into a single sync request.
 * 
 * @param configs - Array of polling configurations
 * @param client - Reality client instance
 * @returns Batch control object
 * 
 * @example
 * ```typescript
 * const client = createRealityClient({ servers: ['https://api.example.com'] });
 * 
 * const batch = createBatchPollingAdapter([
 *   { url: '/api/users', callback: updateUsers },
 *   { url: '/api/stats', callback: updateStats },
 *   { url: '/api/notifications', callback: updateNotifications },
 * ], client);
 * 
 * // Sync all at once
 * batch.syncAll();
 * 
 * // Stop all
 * batch.stopAll();
 * ```
 */
export function createBatchPollingAdapter<T = unknown>(
  configs: Array<{
    url: string;
    callback: PollingCallback<T>;
    options?: PollingAdapterOptions<T>;
  }>,
  client: RealityClient
): {
  adapters: Map<string, PollingAdapterControl>;
  syncAll: (hint?: SyncHint) => Promise<void>;
  stopAll: () => void;
} {
  const adapters = new Map<string, PollingAdapterControl>();

  for (const config of configs) {
    const adapter = createPollingAdapter(
      config.url,
      config.callback,
      client,
      config.options
    );
    adapters.set(config.url, adapter);
  }

  return {
    adapters,
    syncAll: async (hint: SyncHint = 'interaction') => {
      const keys = configs.map((c) => c.options?.realityKey ?? urlToKey(c.url));
      await client.syncKeys(keys, hint);
    },
    stopAll: () => {
      for (const adapter of adapters.values()) {
        adapter.stop();
      }
    },
  };
}

/**
 * Interaction-triggered sync helper
 * 
 * Wraps a callback to trigger sync on interaction.
 * 
 * @example
 * ```typescript
 * const control = createPollingAdapter('/data', updateUI, client);
 * 
 * // Trigger sync when user clicks
 * button.onclick = withInteractionSync(control, () => {
 *   console.log('User clicked, syncing...');
 * });
 * ```
 */
export function withInteractionSync(
  control: PollingAdapterControl,
  callback?: () => void
): () => void {
  return () => {
    control.sync('interaction');
    callback?.();
  };
}

/**
 * Convert URL to Reality key
 */
function urlToKey(url: string): string {
  return url
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/\?.*$/, '')
    .replace(/^\//, '')
    .replace(/\//g, ':');
}
