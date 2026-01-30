import { P as PeerHealth, o as PeerInfo, G as GossipPayload } from '../index-DMEqceRR.js';
import 'zod';

/**
 * @rootlodge/reality-server - Mesh Coordinator
 *
 * Manages peer awareness and gossip protocol for server mesh.
 * Servers are stateless but mesh-aware.
 */

/**
 * Mesh coordinator configuration
 */
interface MeshConfig {
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
declare class MeshCoordinator {
    private config;
    private state;
    constructor(config: MeshConfig);
    /**
     * Get current server ID
     */
    getServerId(): string;
    /**
     * Get current max version seen by this server
     */
    getMaxVersionSeen(): number;
    /**
     * Update max version seen
     */
    updateMaxVersion(version: number): void;
    /**
     * Get peer health map for sync responses
     */
    getPeerHealthMap(): Record<string, PeerHealth>;
    /**
     * Get all peers
     */
    getPeers(): Map<string, PeerInfo>;
    /**
     * Get healthy peers sorted by staleness (least stale first)
     */
    getHealthyPeers(): PeerInfo[];
    /**
     * Create gossip payload to piggyback on responses
     */
    createGossipPayload(): GossipPayload;
    /**
     * Process incoming gossip from a peer
     */
    processGossip(gossip: GossipPayload, sourceUrl: string, latency: number): void;
    /**
     * Mark a peer as unhealthy after failed communication
     */
    markPeerUnhealthy(url: string): void;
    /**
     * Propagate invalidation to peers
     *
     * This is done opportunistically, piggybacking on the next request.
     * It's NOT required for correctness - just acceleration.
     */
    propagateInvalidation(keys: string[]): Promise<void>;
    /**
     * Query a peer for missing versions
     *
     * Used when a client reports versions we haven't seen.
     */
    queryPeerForVersions(sinceVersion: number): Promise<GossipPayload | null>;
    /**
     * Get server URL (for self-identification in gossip)
     */
    private getServerUrl;
    /**
     * Get mesh statistics
     */
    getStats(): {
        serverId: string;
        maxVersionSeen: number;
        peerCount: number;
        healthyPeerCount: number;
        lastGossipTime: number;
    };
}
/**
 * Create mesh coordinator
 */
declare function createMeshCoordinator(config: MeshConfig): MeshCoordinator;

export { type MeshConfig, MeshCoordinator, createMeshCoordinator };
