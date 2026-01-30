/**
 * @rootlodge/reality-server - Mesh Coordinator
 * 
 * Manages peer awareness and gossip protocol for server mesh.
 * Servers are stateless but mesh-aware.
 */

import type { PeerInfo, MeshState, GossipPayload, PeerHealth } from '../types';
import { GossipPayloadSchema } from '../types';

/**
 * Mesh coordinator configuration
 */
export interface MeshConfig {
  /** This server's ID */
  serverId: string;
  /** Peer server URLs */
  peers: string[];
  /** Request timeout for peer communication */
  timeout?: number;
  /** How long before a peer is considered stale */
  staleThreshold?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Mesh Coordinator - manages peer awareness without leader election
 * 
 * Key principles:
 * - No leader election
 * - No background polling loops
 * - Gossip piggybacks on normal requests
 * - Each server maintains its own view of the mesh
 */
export class MeshCoordinator {
  private config: MeshConfig;
  private state: MeshState;

  constructor(config: MeshConfig) {
    this.config = {
      timeout: 5000,
      staleThreshold: 60000,
      debug: false,
      ...config,
    };

    this.state = {
      serverId: config.serverId,
      maxVersionSeen: 0,
      peers: new Map(),
      lastGossipTime: 0,
    };

    // Initialize peer list
    for (const url of config.peers) {
      this.state.peers.set(url, {
        url,
        serverId: '', // Will be populated on first contact
        health: 'unknown',
        maxVersionSeen: 0,
        lastSeen: 0,
        lastLatency: 0,
      });
    }
  }

  /**
   * Get current server ID
   */
  getServerId(): string {
    return this.state.serverId;
  }

  /**
   * Get current max version seen by this server
   */
  getMaxVersionSeen(): number {
    return this.state.maxVersionSeen;
  }

  /**
   * Update max version seen
   */
  updateMaxVersion(version: number): void {
    this.state.maxVersionSeen = Math.max(this.state.maxVersionSeen, version);
  }

  /**
   * Get peer health map for sync responses
   */
  getPeerHealthMap(): Record<string, PeerHealth> {
    const result: Record<string, PeerHealth> = {};
    
    for (const [url, peer] of this.state.peers) {
      result[url] = peer.health;
    }

    return result;
  }

  /**
   * Get all peers
   */
  getPeers(): Map<string, PeerInfo> {
    return new Map(this.state.peers);
  }

  /**
   * Get healthy peers sorted by staleness (least stale first)
   */
  getHealthyPeers(): PeerInfo[] {
    const now = Date.now();
    const staleThreshold = this.config.staleThreshold!;

    return Array.from(this.state.peers.values())
      .filter((peer) => {
        if (peer.health === 'unhealthy') return false;
        if (now - peer.lastSeen > staleThreshold) return false;
        return true;
      })
      .sort((a, b) => {
        // Prefer highest maxVersionSeen (least stale)
        const versionDiff = b.maxVersionSeen - a.maxVersionSeen;
        if (versionDiff !== 0) return versionDiff;
        // Then prefer lowest latency
        return a.lastLatency - b.lastLatency;
      });
  }

  /**
   * Create gossip payload to piggyback on responses
   */
  createGossipPayload(): GossipPayload {
    const peerSummaries = Array.from(this.state.peers.values()).map((peer) => ({
      url: peer.url,
      health: peer.health,
      maxVersion: peer.maxVersionSeen,
      lastSeen: peer.lastSeen,
    }));

    return {
      serverId: this.state.serverId,
      maxVersion: this.state.maxVersionSeen,
      peerSummaries,
      timestamp: Date.now(),
    };
  }

  /**
   * Process incoming gossip from a peer
   */
  processGossip(gossip: GossipPayload, sourceUrl: string, latency: number): void {
    // Validate gossip payload
    const parsed = GossipPayloadSchema.safeParse(gossip);
    if (!parsed.success) {
      if (this.config.debug) {
        console.warn(`[Mesh] Invalid gossip from ${sourceUrl}:`, parsed.error);
      }
      return;
    }

    const now = Date.now();

    // Update source peer info
    const sourcePeer = this.state.peers.get(sourceUrl);
    if (sourcePeer) {
      sourcePeer.serverId = gossip.serverId;
      sourcePeer.health = 'healthy';
      sourcePeer.maxVersionSeen = gossip.maxVersion;
      sourcePeer.lastSeen = now;
      sourcePeer.lastLatency = latency;
    }

    // Process peer summaries (transitive gossip)
    for (const summary of gossip.peerSummaries) {
      // Don't process ourselves
      if (summary.url === this.getServerUrl()) continue;

      let peer = this.state.peers.get(summary.url);
      
      if (!peer) {
        // Discovered a new peer!
        peer = {
          url: summary.url,
          serverId: '',
          health: summary.health,
          maxVersionSeen: summary.maxVersion,
          lastSeen: summary.lastSeen,
          lastLatency: 0,
        };
        this.state.peers.set(summary.url, peer);
        
        if (this.config.debug) {
          console.log(`[Mesh] Discovered new peer: ${summary.url}`);
        }
      } else {
        // Update with more recent info
        if (summary.lastSeen > peer.lastSeen) {
          peer.health = summary.health;
          peer.maxVersionSeen = Math.max(peer.maxVersionSeen, summary.maxVersion);
        }
      }
    }

    this.state.lastGossipTime = now;
  }

  /**
   * Mark a peer as unhealthy after failed communication
   */
  markPeerUnhealthy(url: string): void {
    const peer = this.state.peers.get(url);
    if (peer) {
      peer.health = 'unhealthy';
      
      if (this.config.debug) {
        console.log(`[Mesh] Marked peer unhealthy: ${url}`);
      }
    }
  }

  /**
   * Propagate invalidation to peers
   * 
   * This is done opportunistically, piggybacking on the next request.
   * It's NOT required for correctness - just acceleration.
   */
  async propagateInvalidation(keys: string[]): Promise<void> {
    const healthyPeers = this.getHealthyPeers();
    
    // Propagate to a subset of healthy peers (gossip-style)
    const targetPeers = healthyPeers.slice(0, Math.ceil(healthyPeers.length / 2));

    const promises = targetPeers.map(async (peer) => {
      try {
        const startTime = Date.now();
        
        const response = await fetch(`${peer.url}/reality/invalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Reality-Server': this.state.serverId,
          },
          body: JSON.stringify({
            keys,
            source: this.state.serverId,
            timestamp: Date.now(),
          }),
          signal: AbortSignal.timeout(this.config.timeout!),
        });

        const latency = Date.now() - startTime;

        if (response.ok) {
          // Process any gossip in response
          const gossip = response.headers.get('X-Reality-Gossip');
          if (gossip) {
            try {
              this.processGossip(JSON.parse(gossip), peer.url, latency);
            } catch {
              // Ignore invalid gossip
            }
          }
        } else {
          this.markPeerUnhealthy(peer.url);
        }
      } catch {
        this.markPeerUnhealthy(peer.url);
      }
    });

    // Fire and forget - don't wait for all peers
    Promise.allSettled(promises);
  }

  /**
   * Query a peer for missing versions
   * 
   * Used when a client reports versions we haven't seen.
   */
  async queryPeerForVersions(sinceVersion: number): Promise<GossipPayload | null> {
    const healthyPeers = this.getHealthyPeers();
    
    for (const peer of healthyPeers) {
      // Skip peers that don't have newer versions
      if (peer.maxVersionSeen <= sinceVersion) continue;

      try {
        const startTime = Date.now();
        
        const response = await fetch(
          `${peer.url}/reality/versions?since=${sinceVersion}`,
          {
            headers: {
              'X-Reality-Server': this.state.serverId,
            },
            signal: AbortSignal.timeout(this.config.timeout!),
          }
        );

        const latency = Date.now() - startTime;

        if (response.ok) {
          const gossip = await response.json();
          this.processGossip(gossip, peer.url, latency);
          return gossip;
        }
      } catch {
        this.markPeerUnhealthy(peer.url);
      }
    }

    return null;
  }

  /**
   * Get server URL (for self-identification in gossip)
   */
  private getServerUrl(): string {
    // This should be set from config in production
    return `http://localhost:${process.env.PORT ?? 3000}`;
  }

  /**
   * Get mesh statistics
   */
  getStats(): {
    serverId: string;
    maxVersionSeen: number;
    peerCount: number;
    healthyPeerCount: number;
    lastGossipTime: number;
  } {
    const healthyCount = Array.from(this.state.peers.values())
      .filter((p) => p.health === 'healthy').length;

    return {
      serverId: this.state.serverId,
      maxVersionSeen: this.state.maxVersionSeen,
      peerCount: this.state.peers.size,
      healthyPeerCount: healthyCount,
      lastGossipTime: this.state.lastGossipTime,
    };
  }
}

/**
 * Create mesh coordinator
 */
export function createMeshCoordinator(config: MeshConfig): MeshCoordinator {
  return new MeshCoordinator(config);
}
