/**
 * @rootlodge/reality - Transport Layer
 * 
 * Handles HTTP communication with Reality servers.
 * Supports all environments: Node.js, Browser, React Native, Edge.
 */

import type {
  SyncRequest,
  SyncResponse,
  PeerHealth,
  ResolvedRealityOptions,
  RealityTransport,
} from '../types';
import { SyncResponseSchema } from '../types';
import { now, timeout } from '../utils/time';

/**
 * Server health status tracking
 */
export interface ServerStatus {
  url: string;
  health: PeerHealth;
  lastSuccess: number;
  lastError: number;
  consecutiveFailures: number;
  latency: number;
  maxVersionSeen: number;
  blacklistedUntil: number;
}

/**
 * HTTP Transport - communicates with external Reality servers via HTTP
 * Implements the RealityTransport interface
 */
export class HttpTransport implements RealityTransport {
  private servers: Map<string, ServerStatus> = new Map();
  private options: ResolvedRealityOptions;

  constructor(options: ResolvedRealityOptions) {
    this.options = options;
    
    // Initialize server status
    for (const url of options.servers) {
      this.servers.set(url, {
        url,
        health: 'unknown',
        lastSuccess: 0,
        lastError: 0,
        consecutiveFailures: 0,
        latency: 0,
        maxVersionSeen: 0,
        blacklistedUntil: 0,
      });
    }
  }

  /**
   * Check if HTTP transport is available
   */
  isAvailable(): boolean {
    return this.servers.size > 0 && this.selectServers().length > 0;
  }

  /**
   * Get transport type
   */
  getType(): 'http' | 'embedded' | 'custom' {
    return 'http';
  }

  /**
   * Sync with the best available server
   */
  async sync(request: SyncRequest): Promise<SyncResponse> {
    const servers = this.selectServers();
    
    if (servers.length === 0) {
      throw new Error('No healthy servers available');
    }

    let lastError: Error | null = null;
    
    for (const server of servers) {
      try {
        const response = await this.syncWithServer(server.url, request);
        this.recordSuccess(server.url, response);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordFailure(server.url, lastError);
        
        if (this.options.debug) {
          console.warn(`[Reality] Sync failed with ${server.url}:`, lastError.message);
        }
      }
    }

    throw lastError ?? new Error('Sync failed with all servers');
  }

  /**
   * Sync with a specific server
   */
  private async syncWithServer(url: string, request: SyncRequest): Promise<SyncResponse> {
    const startTime = now();
    
    const fetchPromise = fetch(`${url}/reality/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const response = await timeout(
      fetchPromise,
      this.options.timeout,
      `Request to ${url} timed out`
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    const parsed = SyncResponseSchema.safeParse(json);
    
    if (!parsed.success) {
      throw new Error(`Invalid response format: ${parsed.error.message}`);
    }

    // Record latency
    const server = this.servers.get(url);
    if (server) {
      server.latency = now() - startTime;
    }

    return parsed.data;
  }

  /**
   * Select servers in order of preference
   * Prefers: healthy > known latency > alphabetical
   */
  private selectServers(): ServerStatus[] {
    const currentTime = now();
    
    return Array.from(this.servers.values())
      .filter((s) => s.blacklistedUntil < currentTime)
      .sort((a, b) => {
        // Prefer healthy servers
        const healthOrder = { healthy: 0, unknown: 1, degraded: 2, unhealthy: 3 };
        const healthDiff = healthOrder[a.health] - healthOrder[b.health];
        if (healthDiff !== 0) return healthDiff;
        
        // Then prefer least-stale (highest maxVersionSeen)
        const versionDiff = b.maxVersionSeen - a.maxVersionSeen;
        if (versionDiff !== 0) return versionDiff;
        
        // Then prefer lowest latency
        if (a.latency !== 0 && b.latency !== 0) {
          return a.latency - b.latency;
        }
        
        // Finally, alphabetical for stability
        return a.url.localeCompare(b.url);
      });
  }

  /**
   * Record a successful sync
   */
  private recordSuccess(url: string, response: SyncResponse): void {
    const server = this.servers.get(url);
    if (!server) return;

    server.health = 'healthy';
    server.lastSuccess = now();
    server.consecutiveFailures = 0;
    server.blacklistedUntil = 0;
    
    if (response.mesh.serverVersion !== undefined) {
      server.maxVersionSeen = Math.max(server.maxVersionSeen, response.mesh.serverVersion);
    }

    // Update peer health from mesh info
    for (const [peerUrl, health] of Object.entries(response.mesh.peers)) {
      const peerServer = this.servers.get(peerUrl);
      if (peerServer && peerServer !== server) {
        peerServer.health = health;
      }
    }
  }

  /**
   * Record a failed sync attempt
   */
  private recordFailure(url: string, _error: Error): void {
    const server = this.servers.get(url);
    if (!server) return;

    server.lastError = now();
    server.consecutiveFailures++;
    
    // Update health based on consecutive failures
    if (server.consecutiveFailures >= 3) {
      server.health = 'unhealthy';
      server.blacklistedUntil = now() + this.options.blacklistDuration;
    } else if (server.consecutiveFailures >= 1) {
      server.health = 'degraded';
    }
  }

  /**
   * Get current server status
   */
  getServerStatus(): Map<string, ServerStatus> {
    return new Map(this.servers);
  }

  /**
   * Add a server dynamically (e.g., from mesh discovery)
   */
  addServer(url: string): void {
    if (!this.servers.has(url)) {
      this.servers.set(url, {
        url,
        health: 'unknown',
        lastSuccess: 0,
        lastError: 0,
        consecutiveFailures: 0,
        latency: 0,
        maxVersionSeen: 0,
        blacklistedUntil: 0,
      });
    }
  }

  /**
   * Remove a server
   */
  removeServer(url: string): void {
    this.servers.delete(url);
  }

  /**
   * Clear blacklist for a server (e.g., for manual retry)
   */
  clearBlacklist(url: string): void {
    const server = this.servers.get(url);
    if (server) {
      server.blacklistedUntil = 0;
      server.health = 'unknown';
      server.consecutiveFailures = 0;
    }
  }

  /**
   * Clear all blacklists
   */
  clearAllBlacklists(): void {
    for (const server of this.servers.values()) {
      server.blacklistedUntil = 0;
      server.health = 'unknown';
      server.consecutiveFailures = 0;
    }
  }
}
