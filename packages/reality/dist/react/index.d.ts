import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';
import { E as RealityOptions, t as RealityClient, c as RealityNodeState, S as SyncHint, d as RealityKeyOptions, n as MutationOptions } from '../reality-client-BNAXUCZb.js';
import 'zod';

/**
 * Props for RealityProvider
 */
interface RealityProviderProps {
    children: React.ReactNode;
    /** Reality client options */
    options: RealityOptions;
    /** Pre-created client instance (alternative to options) */
    client?: RealityClient;
}
/**
 * Reality Provider component
 *
 * Provides Reality client to all child components.
 *
 * @example
 * ```tsx
 * <RealityProvider options={{ servers: ['https://api.example.com'] }}>
 *   <App />
 * </RealityProvider>
 * ```
 */
declare function RealityProvider({ children, options, client: providedClient }: RealityProviderProps): react_jsx_runtime.JSX.Element;
/**
 * Hook to access the Reality client
 *
 * @throws Error if used outside of RealityProvider
 */
declare function useRealityClient(): RealityClient;
/**
 * Hook to check if Reality context is available
 */
declare function useHasRealityContext(): boolean;

/**
 * @rootlodge/reality - useReality Hook
 *
 * Main React hook for subscribing to Reality nodes.
 */

/**
 * Return type for useReality hook
 */
interface UseRealityReturn<T> {
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
declare function useReality<T = unknown>(key: string, options?: RealityKeyOptions<T>): UseRealityReturn<T>;
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
declare function useRealityMultiple<T = unknown>(keys: string[], options?: RealityKeyOptions<T>): Map<string, UseRealityReturn<T>>;

/**
 * @rootlodge/reality - useMutation Hook
 *
 * React hook for performing mutations with optimistic updates.
 */

/**
 * Return type for useMutation hook
 */
interface UseMutationReturn<T, TInput> {
    /** Execute the mutation */
    mutate: (input: TInput) => Promise<T>;
    /** Mutation state */
    data: T | undefined;
    error: Error | null;
    isLoading: boolean;
    /** Reset mutation state */
    reset: () => void;
}
/**
 * Hook for performing mutations with optimistic updates
 *
 * @param key - The key to update
 * @param mutationFn - Function that performs the actual mutation
 * @param options - Mutation options including optimistic update
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function SendMessage({ roomId }: { roomId: string }) {
 *   const { mutate, isLoading, error } = useMutation<Message, string>(
 *     `chat:room:${roomId}`,
 *     async (text) => {
 *       const response = await fetch('/api/messages', {
 *         method: 'POST',
 *         body: JSON.stringify({ roomId, text }),
 *       });
 *       return response.json();
 *     },
 *     {
 *       optimisticUpdate: (messages, text) => [
 *         ...(messages ?? []),
 *         { id: 'temp', text, pending: true }
 *       ],
 *       rollbackOnError: true,
 *     }
 *   );
 *
 *   const handleSubmit = async (text: string) => {
 *     try {
 *       await mutate(text);
 *     } catch (err) {
 *       console.error('Failed to send message');
 *     }
 *   };
 *
 *   return <MessageInput onSubmit={handleSubmit} disabled={isLoading} />;
 * }
 * ```
 */
declare function useMutation<T, TInput = void>(key: string, mutationFn: (input: TInput) => Promise<T>, options?: MutationOptions<T, TInput>): UseMutationReturn<T, TInput>;
/**
 * Hook for performing mutations that invalidate multiple keys
 *
 * @param mutationFn - Function that performs the actual mutation
 * @param invalidateKeys - Keys to invalidate after successful mutation
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * function DeleteAllMessages({ roomId }: { roomId: string }) {
 *   const { mutate, isLoading } = useMutationWithInvalidation(
 *     async () => {
 *       await fetch(`/api/rooms/${roomId}/messages`, { method: 'DELETE' });
 *     },
 *     [`chat:room:${roomId}`, `chat:room:${roomId}:count`]
 *   );
 *
 *   return (
 *     <button onClick={() => mutate()} disabled={isLoading}>
 *       Clear All Messages
 *     </button>
 *   );
 * }
 * ```
 */
declare function useMutationWithInvalidation<T, TInput = void>(mutationFn: (input: TInput) => Promise<T>, invalidateKeys: string[]): UseMutationReturn<T, TInput>;

/**
 * @rootlodge/reality - useSync Hook
 *
 * React hook for manual sync control.
 */

/**
 * Return type for useSync hook
 */
interface UseSyncReturn {
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
declare function useSync(): UseSyncReturn;
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
declare function useSyncOnInteraction(keys: string[]): () => void;
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
declare function useSyncOnMount(keys: string[]): void;

export { RealityProvider, type RealityProviderProps, type UseMutationReturn, type UseRealityReturn, type UseSyncReturn, useHasRealityContext, useMutation, useMutationWithInvalidation, useReality, useRealityClient, useRealityMultiple, useSync, useSyncOnInteraction, useSyncOnMount };
