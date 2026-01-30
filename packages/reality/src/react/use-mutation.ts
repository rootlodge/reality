/**
 * @rootlodge/reality - useMutation Hook
 * 
 * React hook for performing mutations with optimistic updates.
 */

import { useState, useCallback, useRef } from 'react';
import type { MutationOptions, MutationResult } from '../types';
import { useRealityClient } from './context';

/**
 * Return type for useMutation hook
 */
export interface UseMutationReturn<T, TInput> {
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
export function useMutation<T, TInput = void>(
  key: string,
  mutationFn: (input: TInput) => Promise<T>,
  options: MutationOptions<T, TInput> = {}
): UseMutationReturn<T, TInput> {
  const client = useRealityClient();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<MutationResult<T>>({
    data: undefined,
    error: null,
    isLoading: false,
  });

  const mutate = useCallback(
    async (input: TInput): Promise<T> => {
      setState({ data: undefined, error: null, isLoading: true });

      try {
        const result = await client.mutate(key, input, mutationFn, optionsRef.current);
        setState({ data: result, error: null, isLoading: false });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({ data: undefined, error: err, isLoading: false });
        throw err;
      }
    },
    [client, key, mutationFn]
  );

  const reset = useCallback(() => {
    setState({ data: undefined, error: null, isLoading: false });
  }, []);

  return {
    mutate,
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    reset,
  };
}

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
export function useMutationWithInvalidation<T, TInput = void>(
  mutationFn: (input: TInput) => Promise<T>,
  invalidateKeys: string[]
): UseMutationReturn<T, TInput> {
  const client = useRealityClient();

  const [state, setState] = useState<MutationResult<T>>({
    data: undefined,
    error: null,
    isLoading: false,
  });

  const mutate = useCallback(
    async (input: TInput): Promise<T> => {
      setState({ data: undefined, error: null, isLoading: true });

      try {
        const result = await mutationFn(input);
        
        // Invalidate all specified keys
        await client.invalidate(invalidateKeys);
        
        setState({ data: result, error: null, isLoading: false });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({ data: undefined, error: err, isLoading: false });
        throw err;
      }
    },
    [client, mutationFn, invalidateKeys.join(',')]
  );

  const reset = useCallback(() => {
    setState({ data: undefined, error: null, isLoading: false });
  }, []);

  return {
    mutate,
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    reset,
  };
}
