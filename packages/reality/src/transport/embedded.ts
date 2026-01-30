/**
 * @rootlodge/reality - Embedded Transport
 * 
 * In-process transport for SSR/TanStack/Vite environments.
 * No HTTP overhead - direct function calls to embedded server.
 */

import type {
  SyncRequest,
  SyncResponse,
  RealityTransport,
  RealityNodeMeta,
  ChangedNode,
  PeerHealth,
} from '../types';

/**
 * Embedded server interface
 * This is a minimal interface that embedded servers must implement
 */
export interface EmbeddedRealityServer {
  /** Handle a sync request directly */
  handleSync(request: SyncRequest): Promise<SyncResponse>;
  /** Invalidate keys */
  invalidate(keys: string[]): Promise<void>;
  /** Get node metadata */
  getNode(key: string): Promise<RealityNodeMeta | null>;
  /** Update a node's version */
  updateNode(key: string, hash: string): Promise<RealityNodeMeta>;
  /** Get server ID */
  getServerId(): string;
}

/**
 * Global registry of embedded servers for SSR context
 * Allows multiple embedded servers per request context
 */
const embeddedServerRegistry = new Map<string, EmbeddedRealityServer>();

/**
 * Register an embedded server instance
 */
export function registerEmbeddedServer(serverId: string, server: EmbeddedRealityServer): void {
  embeddedServerRegistry.set(serverId, server);
}

/**
 * Unregister an embedded server instance
 */
export function unregisterEmbeddedServer(serverId: string): void {
  embeddedServerRegistry.delete(serverId);
}

/**
 * Get an embedded server by ID
 */
export function getEmbeddedServer(serverId?: string): EmbeddedRealityServer | undefined {
  if (serverId) {
    return embeddedServerRegistry.get(serverId);
  }
  // Return first available server if no ID specified
  const first = embeddedServerRegistry.values().next();
  return first.done ? undefined : first.value;
}

/**
 * Check if any embedded server is available
 */
export function hasEmbeddedServer(): boolean {
  return embeddedServerRegistry.size > 0;
}

/**
 * Embedded Transport - in-process communication for SSR
 * Implements the RealityTransport interface
 */
export class EmbeddedTransport implements RealityTransport {
  private serverId?: string;
  private fallbackTransport?: RealityTransport;

  constructor(options: {
    /** Specific server ID to use */
    serverId?: string;
    /** Fallback transport if embedded not available */
    fallback?: RealityTransport;
  } = {}) {
    this.serverId = options.serverId;
    this.fallbackTransport = options.fallback;
  }

  /**
   * Check if embedded transport is available
   */
  isAvailable(): boolean {
    return hasEmbeddedServer() || (this.fallbackTransport?.isAvailable() ?? false);
  }

  /**
   * Get transport type
   */
  getType(): 'http' | 'embedded' | 'custom' {
    if (hasEmbeddedServer()) {
      return 'embedded';
    }
    return this.fallbackTransport?.getType() ?? 'embedded';
  }

  /**
   * Sync using embedded server or fallback
   */
  async sync(request: SyncRequest): Promise<SyncResponse> {
    const server = getEmbeddedServer(this.serverId);
    
    if (server) {
      return server.handleSync(request);
    }
    
    if (this.fallbackTransport) {
      return this.fallbackTransport.sync(request);
    }
    
    throw new Error('No embedded server available and no fallback transport configured');
  }

  /**
   * Invalidate keys using embedded server
   */
  async invalidate(keys: string[]): Promise<void> {
    const server = getEmbeddedServer(this.serverId);
    
    if (server) {
      await server.invalidate(keys);
      return;
    }
    
    if (this.fallbackTransport?.invalidate) {
      await this.fallbackTransport.invalidate(keys);
      return;
    }
    
    // Silently ignore if no server available
  }

  /**
   * Set fallback transport
   */
  setFallback(transport: RealityTransport): void {
    this.fallbackTransport = transport;
  }
}

/**
 * Create an auto-selecting transport
 * Prefers embedded, falls back to HTTP
 */
export function createAutoTransport(options: {
  /** HTTP server URLs for fallback */
  servers?: string[];
  /** Preferred embedded server ID */
  embeddedServerId?: string;
  /** Custom fallback transport */
  fallback?: RealityTransport;
}): RealityTransport {
  // If we have an embedded server, use it with HTTP fallback
  if (hasEmbeddedServer()) {
    return new EmbeddedTransport({
      serverId: options.embeddedServerId,
      fallback: options.fallback,
    });
  }
  
  // Otherwise return the fallback or throw
  if (options.fallback) {
    return options.fallback;
  }
  
  throw new Error('No embedded server available and no fallback transport provided');
}

/**
 * Simple in-memory embedded server for SSR
 * Use this for basic SSR scenarios where you don't need full server features
 */
export class SimpleEmbeddedServer implements EmbeddedRealityServer {
  private nodes: Map<string, RealityNodeMeta> = new Map();
  private maxVersion = 0;
  private serverId: string;

  constructor(serverId = 'embedded-ssr') {
    this.serverId = serverId;
  }

  getServerId(): string {
    return this.serverId;
  }

  async handleSync(request: SyncRequest): Promise<SyncResponse> {
    const changed: Record<string, ChangedNode> = {};
    
    for (const [key, clientVersion] of Object.entries(request.known)) {
      const meta = this.nodes.get(key);
      
      if (!meta) {
        // Key doesn't exist
        changed[key] = {
          version: 0,
          hash: '',
          source: this.serverId,
        };
        continue;
      }
      
      if (meta.version > clientVersion) {
        changed[key] = {
          version: meta.version,
          hash: meta.hash,
          source: this.serverId,
        };
      }
    }
    
    return {
      changed,
      mesh: {
        peers: {} as Record<string, PeerHealth>,
        serverVersion: this.maxVersion,
      },
      serverTime: Date.now(),
    };
  }

  async invalidate(keys: string[]): Promise<void> {
    for (const key of keys) {
      const existing = this.nodes.get(key);
      if (existing) {
        this.maxVersion++;
        this.nodes.set(key, {
          ...existing,
          version: this.maxVersion,
          updatedAt: Date.now(),
        });
      }
    }
  }

  async getNode(key: string): Promise<RealityNodeMeta | null> {
    return this.nodes.get(key) ?? null;
  }

  async updateNode(key: string, hash: string): Promise<RealityNodeMeta> {
    this.maxVersion++;
    const meta: RealityNodeMeta = {
      key,
      version: this.maxVersion,
      hash,
      updatedAt: Date.now(),
    };
    this.nodes.set(key, meta);
    return meta;
  }

  /**
   * Register this server in the global registry
   */
  register(): void {
    registerEmbeddedServer(this.serverId, this);
  }

  /**
   * Unregister this server
   */
  unregister(): void {
    unregisterEmbeddedServer(this.serverId);
  }
}

/**
 * Create and register a simple embedded server
 */
export function createSimpleEmbeddedServer(serverId = 'embedded-ssr'): SimpleEmbeddedServer {
  const server = new SimpleEmbeddedServer(serverId);
  server.register();
  return server;
}
