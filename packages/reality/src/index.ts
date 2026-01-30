/**
 * @rootlodge/reality - Client Package Entry Point
 * 
 * Socketless Real-Time Infrastructure
 * 
 * IMPORTANT: Reality does NOT own your data!
 * - Reality only tracks change metadata (version/hash)
 * - Your application stores the actual payloads
 * - Works without any database
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

// Transport abstraction
export {
  HttpTransport,
  EmbeddedTransport,
  SimpleEmbeddedServer,
  createSimpleEmbeddedServer,
  createAutoTransport,
  registerEmbeddedServer,
  unregisterEmbeddedServer,
  getEmbeddedServer,
  hasEmbeddedServer,
  type ServerStatus,
  type EmbeddedRealityServer,
} from './transport';

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

// SSR / TanStack support
export {
  TanStackRealityAdapter,
  createRealityTanStackAdapter,
  createSSRContext,
  serializeRealityState,
  deserializeRealityState,
  isSSR,
  isHydrated,
  type TanStackAdapterConfig,
  type TanStackRealityState,
  type SSRContext,
} from './ssr';

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

// Import for default export
import { createRealityClient as _createRealityClient } from './client/reality-client';

/**
 * Default export for convenient imports
 */
export default {
  createRealityClient: _createRealityClient,
};
