/**
 * @rootlodge/reality - TanStack Integration
 * 
 * Helpers for integrating Reality with TanStack Start, TanStack Router,
 * and other TanStack ecosystem tools.
 */

import type {
  SyncRequest,
  SyncResponse,
  RealityNodeMeta,
  RealityMode,
  SyncHint,
} from '../types';
import { generateUUID } from '../utils/uuid';
import {
  EmbeddedTransport,
  SimpleEmbeddedServer,
  hasEmbeddedServer,
  getEmbeddedServer,
} from '../transport/embedded';

/**
 * TanStack adapter configuration
 */
export interface TanStackAdapterConfig {
  /** Keys to prefetch during SSR */
  keys?: string[];
  /** Server ID for the embedded server */
  serverId?: string;
  /** Initial known versions (from hydration) */
  initialKnown?: Record<string, number>;
  /** Custom sync handler (for connecting to external embedded server) */
  syncHandler?: (request: SyncRequest) => Promise<SyncResponse>;
}

/**
 * TanStack adapter state for hydration
 */
export interface TanStackRealityState {
  /** Node metadata keyed by key */
  nodes: Record<string, RealityNodeMeta>;
  /** Max version seen */
  maxVersion: number;
  /** Server ID */
  serverId: string;
  /** Timestamp of state capture */
  capturedAt: number;
}

/**
 * TanStack Reality Adapter
 * 
 * Provides SSR support for TanStack Start and TanStack Router.
 * 
 * @example
 * ```typescript
 * // In your TanStack Start loader
 * import { createRealityTanStackAdapter } from '@rootlodge/reality/tanstack';
 * 
 * export const loader = async () => {
 *   const reality = createRealityTanStackAdapter({
 *     keys: ['chat:room:123', 'user:profile'],
 *   });
 *   
 *   // Prefetch data and get hydration state
 *   const state = await reality.prefetch();
 *   
 *   return {
 *     realityState: state,
 *   };
 * };
 * 
 * // In your component
 * function Chat({ realityState }) {
 *   return (
 *     <RealityProvider 
 *       hydrationState={realityState}
 *       mode="auto"
 *     >
 *       <ChatMessages />
 *     </RealityProvider>
 *   );
 * }
 * ```
 */
export class TanStackRealityAdapter {
  private config: TanStackAdapterConfig;
  private server: SimpleEmbeddedServer | null = null;
  private clientId: string;

  constructor(config: TanStackAdapterConfig = {}) {
    this.config = config;
    this.clientId = generateUUID();
    
    // Create embedded server if we don't have a sync handler
    if (!config.syncHandler && !hasEmbeddedServer()) {
      this.server = new SimpleEmbeddedServer(config.serverId ?? 'tanstack-ssr');
      this.server.register();
    }
  }

  /**
   * Prefetch specified keys and return hydration state
   */
  async prefetch(): Promise<TanStackRealityState> {
    const keys = this.config.keys ?? [];
    const known: Record<string, number> = {};
    
    // Initialize known versions
    for (const key of keys) {
      known[key] = this.config.initialKnown?.[key] ?? 0;
    }
    
    // Perform sync
    const request: SyncRequest = {
      known,
      clientId: this.clientId,
      mode: 'native' as RealityMode,
      hint: 'mount' as SyncHint,
      timestamp: Date.now(),
    };
    
    let response: SyncResponse;
    
    if (this.config.syncHandler) {
      response = await this.config.syncHandler(request);
    } else {
      const server = getEmbeddedServer(this.config.serverId);
      if (!server) {
        throw new Error('No embedded server available for TanStack adapter');
      }
      response = await server.handleSync(request);
    }
    
    // Build hydration state
    const nodes: Record<string, RealityNodeMeta> = {};
    let maxVersion = 0;
    
    for (const [key, changed] of Object.entries(response.changed)) {
      if (changed.version > 0) {
        nodes[key] = {
          key,
          version: changed.version,
          hash: changed.hash,
          updatedAt: response.serverTime,
        };
        maxVersion = Math.max(maxVersion, changed.version);
      }
    }
    
    return {
      nodes,
      maxVersion,
      serverId: this.config.serverId ?? 'tanstack-ssr',
      capturedAt: Date.now(),
    };
  }

  /**
   * Update a node (for use in server actions)
   */
  async updateNode(key: string, hash: string): Promise<RealityNodeMeta> {
    if (this.server) {
      return this.server.updateNode(key, hash);
    }
    
    const server = getEmbeddedServer(this.config.serverId);
    if (!server) {
      throw new Error('No embedded server available');
    }
    return server.updateNode(key, hash);
  }

  /**
   * Invalidate keys (for use in server actions)
   */
  async invalidate(keys: string[]): Promise<void> {
    if (this.server) {
      await this.server.invalidate(keys);
      return;
    }
    
    const server = getEmbeddedServer(this.config.serverId);
    if (server) {
      await server.invalidate(keys);
    }
  }

  /**
   * Get embedded transport for client use
   */
  getTransport(): EmbeddedTransport {
    return new EmbeddedTransport({
      serverId: this.config.serverId,
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.server) {
      this.server.unregister();
      this.server = null;
    }
  }
}

/**
 * Create a TanStack Reality adapter
 * 
 * @example
 * ```typescript
 * // Basic usage in loader
 * const adapter = createRealityTanStackAdapter({
 *   keys: ['chat:room:123'],
 * });
 * const state = await adapter.prefetch();
 * ```
 */
export function createRealityTanStackAdapter(config: TanStackAdapterConfig = {}): TanStackRealityAdapter {
  return new TanStackRealityAdapter(config);
}

/**
 * SSR Context for React Server Components
 */
export interface SSRContext {
  adapter: TanStackRealityAdapter;
  state: TanStackRealityState | null;
}

/**
 * Create SSR context for use in React Server Components
 */
export function createSSRContext(config: TanStackAdapterConfig = {}): SSRContext {
  return {
    adapter: createRealityTanStackAdapter(config),
    state: null,
  };
}

/**
 * Helper to serialize Reality state for hydration
 */
export function serializeRealityState(state: TanStackRealityState): string {
  return JSON.stringify(state);
}

/**
 * Helper to deserialize Reality state from hydration
 */
export function deserializeRealityState(serialized: string): TanStackRealityState {
  return JSON.parse(serialized);
}

/**
 * Check if we're in SSR context
 */
export function isSSR(): boolean {
  return typeof window === 'undefined';
}

/**
 * Check if Reality is hydrated
 */
export function isHydrated(): boolean {
  return typeof window !== 'undefined' && hasEmbeddedServer();
}
