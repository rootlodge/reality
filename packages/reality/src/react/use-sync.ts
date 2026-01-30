/**
 * @rootlodge/reality - useSync Hook
 * 
 * React hook for manual sync control.
 */

import { useCallback } from 'react';
import type { SyncHint } from '../types';
import { useRealityClient } from './context';

/**
 * Return type for useSync hook
 */
export interface UseSyncReturn {
  /** Sync specific keys */
  syncKeys: (keys: string[], hint?: SyncHint) => Promise<void>;
  /** Sync all subscribed keys */
  syncAll: (hint?: SyncHint) => Promise<void>;
  /** Invalidate and sync specific keys */
  invalidate: (keys: string[]) => Promise<void>;
  /** Get sync statistics */
  getStats: () => {
    subscribedKeys: number;
    lastSyncTime: number;
    isSyncing: boolean;
  };
}

/**
 * Hook for manual sync control
 * 
 * Useful when you need fine-grained control over sync timing,
 * or when triggering syncs from non-component code.
 * 
 * @example
 * ```tsx
 * function RefreshButton() {
 *   const { syncAll, getStats } = useSync();
 *   const stats = getStats();
 * 
 *   return (
 *     <button
 *       onClick={() => syncAll('interaction')}
 *       disabled={stats.isSyncing}
 *     >
 *       {stats.isSyncing ? 'Syncing...' : 'Refresh'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useSync(): UseSyncReturn {
  const client = useRealityClient();

  const syncKeys = useCallback(
    async (keys: string[], hint: SyncHint = 'interaction') => {
      await client.syncKeys(keys, hint);
    },
    [client]
  );

  const syncAll = useCallback(
    async (hint: SyncHint = 'interaction') => {
      await client.syncAll(hint);
    },
    [client]
  );

  const invalidate = useCallback(
    async (keys: string[]) => {
      await client.invalidate(keys);
    },
    [client]
  );

  const getStats = useCallback(() => client.getStats(), [client]);

  return {
    syncKeys,
    syncAll,
    invalidate,
    getStats,
  };
}

/**
 * Hook for triggering sync on user interaction
 * 
 * Returns a callback that triggers sync when called.
 * Useful for forms, buttons, and other interactive elements.
 * 
 * @param keys - Keys to sync on interaction
 * @returns Interaction handler that triggers sync
 * 
 * @example
 * ```tsx
 * function ChatInput({ roomId }: { roomId: string }) {
 *   const onInteraction = useSyncOnInteraction([`chat:room:${roomId}`]);
 * 
 *   return (
 *     <input
 *       type="text"
 *       onFocus={onInteraction}
 *       placeholder="Type a message..."
 *     />
 *   );
 * }
 * ```
 */
export function useSyncOnInteraction(keys: string[]): () => void {
  const { syncKeys } = useSync();
  
  return useCallback(() => {
    syncKeys(keys, 'interaction');
  }, [syncKeys, keys.join(',')]);
}

/**
 * Hook for triggering sync when component mounts
 * 
 * @param keys - Keys to sync on mount
 * 
 * @example
 * ```tsx
 * function Dashboard() {
 *   useSyncOnMount(['stats:users', 'stats:revenue']);
 * 
 *   return <DashboardContent />;
 * }
 * ```
 */
export function useSyncOnMount(keys: string[]): void {
  const { syncKeys } = useSync();

  // Use layoutEffect to sync before paint
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { useLayoutEffect } = require('react');
    useLayoutEffect(() => {
      syncKeys(keys, 'mount');
    }, [keys.join(',')]);
  }
}
