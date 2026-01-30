/**
 * @rootlodge/reality-server - Server SSE Compatibility
 * 
 * Server-side compatibility for SSE migration.
 * Translates Reality updates into SSE-formatted responses.
 */

import type { RealityStorage, RealityNodeMeta } from '../types';
import { MeshCoordinator } from '../mesh/coordinator';

/**
 * SSE Compatibility adapter configuration
 */
export interface SSECompatConfig {
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
 * SSE message format
 */
interface SSEMessage {
  id: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * Format SSE message
 */
function formatSSEMessage(message: SSEMessage): string {
  let result = '';
  
  if (message.id) {
    result += `id: ${message.id}\n`;
  }
  if (message.event) {
    result += `event: ${message.event}\n`;
  }
  if (message.retry !== undefined) {
    result += `retry: ${message.retry}\n`;
  }
  
  // Data can be multiline
  const dataLines = message.data.split('\n');
  for (const line of dataLines) {
    result += `data: ${line}\n`;
  }
  
  result += '\n';
  return result;
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
export class SSECompatAdapter {
  private config: SSECompatConfig;

  constructor(config: SSECompatConfig) {
    this.config = {
      transform: (key, data) => JSON.stringify(data),
      ...config,
    };
  }

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
  async handleRequest(
    lastEventId: string | null,
    keys: string[]
  ): Promise<{
    body: string;
    headers: Record<string, string>;
    hasChanges: boolean;
  }> {
    // Parse last event ID to get version
    const lastVersion = this.parseEventId(lastEventId);

    // Get nodes that have changed
    const changedNodes = await this.config.storage.listChangedSince(lastVersion);

    // Filter to only requested keys
    const relevantChanges = changedNodes.filter((node) =>
      keys.length === 0 || keys.includes(node.key)
    );

    // Build SSE response
    let body = '';
    let maxVersion = lastVersion;

    for (const node of relevantChanges) {
      // Fetch payload if available
      let payload: unknown = null;
      if (this.config.payloadFetcher) {
        try {
          payload = await this.config.payloadFetcher(node.key);
        } catch {
          // Skip if payload fetch fails
          continue;
        }
      }

      const message: SSEMessage = {
        id: this.createEventId(node),
        event: 'update',
        data: this.config.transform!(node.key, payload ?? { key: node.key, version: node.version }),
      };

      body += formatSSEMessage(message);
      maxVersion = Math.max(maxVersion, node.version);
    }

    // Add a heartbeat message if no changes
    if (body === '') {
      const heartbeat: SSEMessage = {
        id: `heartbeat:${Date.now()}`,
        event: 'heartbeat',
        data: JSON.stringify({ timestamp: Date.now() }),
      };
      body = formatSSEMessage(heartbeat);
    }

    return {
      body,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'X-Reality-Version': String(maxVersion),
      },
      hasChanges: relevantChanges.length > 0,
    };
  }

  /**
   * Create a Fetch API handler for SSE-compatible endpoint
   */
  createFetchHandler(
    getKeysFromRequest: (request: Request) => string[]
  ): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
      const lastEventId = request.headers.get('Last-Event-ID');
      const keys = getKeysFromRequest(request);

      const result = await this.handleRequest(lastEventId, keys);

      return new Response(result.body, {
        status: 200,
        headers: result.headers,
      });
    };
  }

  /**
   * Parse event ID to extract version
   */
  private parseEventId(eventId: string | null): number {
    if (!eventId) return 0;
    
    // Format: "version:hash" or just version number
    const parts = eventId.split(':');
    const version = parseInt(parts[0] ?? '0', 10);
    return isNaN(version) ? 0 : version;
  }

  /**
   * Create event ID from node metadata
   */
  private createEventId(node: RealityNodeMeta): string {
    return `${node.version}:${node.hash}`;
  }
}

/**
 * Create SSE compatibility adapter
 */
export function createSSECompatAdapter(config: SSECompatConfig): SSECompatAdapter {
  return new SSECompatAdapter(config);
}
