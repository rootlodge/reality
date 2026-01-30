/**
 * @rootlodge/reality - useReality Hook
 * 
 * Main React hook for subscribing to Reality nodes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  RealityNodeState,
  RealityKeyOptions,
  SyncHint,
} from '../types';
import { useRealityClient } from './context';

/**
 * Return type for useReality hook
 */
export interface UseRealityReturn<T> {
  /** Current data (includes optimistic updates) */
  data: T | undefined;
  /** Error if any occurred */
  error: Error | null;
  /** True while initial data is loading */
  isLoading: boolean;
  /** True while syncing with server */
  isSyncing: boolean;
  /** True if data is stale */
  isStale: boolean;
  /** Node metadata */
  meta: RealityNodeState<T>['meta'];
  /** Timestamp of last successful sync */
  lastSyncAt: number | null;
  /** Manually trigger a sync */
  sync: (hint?: SyncHint) => Promise<void>;
  /** Invalidate and refetch */
  invalidate: () => Promise<void>;
}

/**
 * Hook for subscribing to a Reality node
 * 
 * @param key - The key identifying the reality node
 * @param options - Configuration options
 * @returns Reality state and controls
 * 
 * @example
 * ```tsx
 * function ChatRoom({ roomId }: { roomId: string }) {
 *   const { data: messages, isLoading, sync } = useReality<Message[]>(
 *     `chat:room:${roomId}`,
 *     { fallback: [] }
 *   );
 * 
 *   if (isLoading) return <Loading />;
 * 
 *   return (
 *     <div>
 *       {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *       <button onClick={() => sync()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useReality<T = unknown>(
  key: string,
  options: RealityKeyOptions<T> = {}
): UseRealityReturn<T> {
  const client = useRealityClient();
  
  // Use ref to track options changes without causing re-subscriptions
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // State for the reality node
  const [state, setState] = useState<RealityNodeState<T>>(() => {
    const existing = client.getState<T>(key);
    return existing ?? {
      key,
      data: options.fallback,
      meta: null,
      status: 'idle',
      error: null,
      isLoading: true,
      isSyncing: false,
      isStale: true,
      lastSyncAt: null,
    };
  });

  // Subscribe to the reality node
  useEffect(() => {
    const unsubscribe = client.subscribe<T>(key, setState, optionsRef.current);
    
    return () => {
      unsubscribe();
    };
  }, [client, key]);

  // Sync function
  const sync = useCallback(
    async (hint: SyncHint = 'interaction') => {
      await client.syncKeys([key], hint);
    },
    [client, key]
  );

  // Invalidate function
  const invalidate = useCallback(async () => {
    await client.invalidate([key]);
  }, [client, key]);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    isSyncing: state.isSyncing,
    isStale: state.isStale,
    meta: state.meta,
    lastSyncAt: state.lastSyncAt,
    sync,
    invalidate,
  };
}

/**
 * Hook for multiple Reality nodes
 * 
 * @param keys - Array of keys to subscribe to
 * @param options - Shared configuration options
 * @returns Map of key to Reality state
 * 
 * @example
 * ```tsx
 * function Dashboard() {
 *   const states = useRealityMultiple([
 *     'stats:users',
 *     'stats:revenue',
 *     'stats:orders'
 *   ]);
 * 
 *   return (
 *     <div>
 *       {Array.from(states.entries()).map(([key, state]) => (
 *         <StatCard key={key} data={state.data} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRealityMultiple<T = unknown>(
  keys: string[],
  options: RealityKeyOptions<T> = {}
): Map<string, UseRealityReturn<T>> {
  const client = useRealityClient();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // State map for all keys
  const [states, setStates] = useState<Map<string, RealityNodeState<T>>>(() => {
    const initial = new Map<string, RealityNodeState<T>>();
    for (const key of keys) {
      const existing = client.getState<T>(key);
      initial.set(key, existing ?? {
        key,
        data: options.fallback,
        meta: null,
        status: 'idle',
        error: null,
        isLoading: true,
        isSyncing: false,
        isStale: true,
        lastSyncAt: null,
      });
    }
    return initial;
  });

  // Subscribe to all keys
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    for (const key of keys) {
      const unsubscribe = client.subscribe<T>(key, (state) => {
        setStates((prev) => {
          const next = new Map(prev);
          next.set(key, state);
          return next;
        });
      }, optionsRef.current);
      
      unsubscribes.push(unsubscribe);
    }

    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [client, keys.join(',')]);

  // Build return map with controls
  const result = new Map<string, UseRealityReturn<T>>();
  
  for (const [key, state] of states) {
    result.set(key, {
      data: state.data,
      error: state.error,
      isLoading: state.isLoading,
      isSyncing: state.isSyncing,
      isStale: state.isStale,
      meta: state.meta,
      lastSyncAt: state.lastSyncAt,
      sync: async (hint: SyncHint = 'interaction') => {
        await client.syncKeys([key], hint);
      },
      invalidate: async () => {
        await client.invalidate([key]);
      },
    });
  }

  return result;
}
