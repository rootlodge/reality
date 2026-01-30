import { R as RealityStorage } from '../index-DMEqceRR.js';
import { MeshCoordinator } from '../mesh/index.js';
import 'zod';

/**
 * @rootlodge/reality-server - Server SSE Compatibility
 *
 * Server-side compatibility for SSE migration.
 * Translates Reality updates into SSE-formatted responses.
 */

/**
 * SSE Compatibility adapter configuration
 */
interface SSECompatConfig {
    /** Storage adapter */
    storage: RealityStorage;
    /** Mesh coordinator */
    mesh: MeshCoordinator;
    /** Transform node data for SSE event */
    transform?: (key: string, data: unknown) => string;
    /** Optional: Fetch payload for a key */
    payloadFetcher?: (key: string) => Promise<unknown>;
}
/**
 * SSE Compatibility Adapter
 *
 * This adapter helps migrate SSE endpoints to Reality by:
 * 1. Accepting SSE-style requests
 * 2. Converting Reality node updates to SSE event format
 * 3. Returning short-lived HTTP responses (NOT streaming)
 *
 * IMPORTANT: This does NOT create long-lived SSE connections.
 * It returns data in SSE format for clients to process identically.
 */
declare class SSECompatAdapter {
    private config;
    constructor(config: SSECompatConfig);
    /**
     * Handle an SSE-style request
     *
     * Returns data in SSE format but via a normal HTTP response.
     * Client's EventSource polyfill will need to poll this endpoint.
     *
     * @param lastEventId - The Last-Event-ID from the client
     * @param keys - Keys to check for updates (derived from URL path)
     * @returns SSE-formatted response body
     */
    handleRequest(lastEventId: string | null, keys: string[]): Promise<{
        body: string;
        headers: Record<string, string>;
        hasChanges: boolean;
    }>;
    /**
     * Create a Fetch API handler for SSE-compatible endpoint
     */
    createFetchHandler(getKeysFromRequest: (request: Request) => string[]): (request: Request) => Promise<Response>;
    /**
     * Parse event ID to extract version
     */
    private parseEventId;
    /**
     * Create event ID from node metadata
     */
    private createEventId;
}
/**
 * Create SSE compatibility adapter
 */
declare function createSSECompatAdapter(config: SSECompatConfig): SSECompatAdapter;

/**
 * @rootlodge/reality-server - Server Polling Compatibility
 *
 * Server-side compatibility for polling migration.
 * Returns data in the same format as traditional polling endpoints.
 */

/**
 * Polling compatibility adapter configuration
 */
interface PollingCompatConfig {
    /** Storage adapter */
    storage: RealityStorage;
    /** Mesh coordinator */
    mesh: MeshCoordinator;
    /** Optional: Fetch payload for a key */
    payloadFetcher?: (key: string) => Promise<unknown>;
    /** Optional: Transform response format */
    transform?: (data: Map<string, unknown>) => unknown;
}
/**
 * Polling Compatibility Adapter
 *
 * This adapter helps migrate polling endpoints to Reality by:
 * 1. Accepting requests in the same format as existing polling endpoints
 * 2. Returning data in the same format
 * 3. Adding Reality versioning for efficient future syncs
 */
declare class PollingCompatAdapter {
    private config;
    constructor(config: PollingCompatConfig);
    /**
     * Handle a polling-style request
     *
     * @param keys - Keys to fetch
     * @param ifModifiedSince - Optional version for conditional request
     * @returns Response data and metadata
     */
    handleRequest(keys: string[], ifModifiedSince?: number): Promise<{
        data: unknown;
        headers: Record<string, string>;
        status: number;
        modified: boolean;
    }>;
    /**
     * Create a Fetch API handler for polling-compatible endpoint
     */
    createFetchHandler(getKeysFromRequest: (request: Request) => string[]): (request: Request) => Promise<Response>;
}
/**
 * Create polling compatibility adapter
 */
declare function createPollingCompatAdapter(config: PollingCompatConfig): PollingCompatAdapter;

export { PollingCompatAdapter, type PollingCompatConfig, SSECompatAdapter, type SSECompatConfig, createPollingCompatAdapter, createSSECompatAdapter };
