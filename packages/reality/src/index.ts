/**
 * @rootlodge/reality - Client Package Entry Point
 * 
 * Socketless Real-Time Infrastructure
 * 
 * @packageDocumentation
 */

// Core types
export * from './types';

// Utilities
export * from './utils';

// Client
export { RealityClient, createRealityClient } from './client/reality-client';
export { SyncEngine } from './client/sync-engine';

// Transport
export { RealityTransport } from './transport/transport';

// React integration
export {
  RealityProvider,
  useRealityClient,
  useHasRealityContext,
  type RealityProviderProps,
} from './react/context';

export {
  useReality,
  useRealityMultiple,
  type UseRealityReturn,
} from './react/use-reality';

export {
  useMutation,
  useMutationWithInvalidation,
  type UseMutationReturn,
} from './react/use-mutation';

export {
  useSync,
  useSyncOnInteraction,
  useSyncOnMount,
  type UseSyncReturn,
} from './react/use-sync';

// Compatibility layers
export {
  createEventSource,
  createEventSourceFactory,
  RealityEventSource,
  SSEReadyState,
  type SSEMessageEvent,
  type SSEEventListener,
  type EventSourceOptions,
} from './compat/sse';

export {
  createPollingAdapter,
  createBatchPollingAdapter,
  withInteractionSync,
  type PollingCallback,
  type PollingAdapterOptions,
  type PollingAdapterControl,
} from './compat/polling';

// Convenience re-export for common usage
export { createHash, hashEquals, combineHashes } from './utils/hash';
export { generateUUID, isValidUUID } from './utils/uuid';

/**
 * Default export for convenient imports
 */
export default {
  createRealityClient,
};
