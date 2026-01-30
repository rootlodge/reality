/**
 * @rootlodge/reality-server - Server Polling Compatibility
 * 
 * Server-side compatibility for polling migration.
 * Returns data in the same format as traditional polling endpoints.
 */

import type { RealityStorage } from '../types';
import { MeshCoordinator } from '../mesh/coordinator';

/**
 * Polling compatibility adapter configuration
 */
export interface PollingCompatConfig {
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
export class PollingCompatAdapter {
  private config: PollingCompatConfig;

  constructor(config: PollingCompatConfig) {
    this.config = config;
  }

  /**
   * Handle a polling-style request
   * 
   * @param keys - Keys to fetch
   * @param ifModifiedSince - Optional version for conditional request
   * @returns Response data and metadata
   */
  async handleRequest(
    keys: string[],
    ifModifiedSince?: number
  ): Promise<{
    data: unknown;
    headers: Record<string, string>;
    status: number;
    modified: boolean;
  }> {
    // Get current metadata for all keys
    const metas = await this.config.storage.getNodes(keys);

    // Check if any have changed since ifModifiedSince
    let maxVersion = 0;
    let hasChanges = false;

    for (const meta of metas.values()) {
      maxVersion = Math.max(maxVersion, meta.version);
      if (ifModifiedSince === undefined || meta.version > ifModifiedSince) {
        hasChanges = true;
      }
    }

    // If nothing changed, return 304
    if (ifModifiedSince !== undefined && !hasChanges) {
      return {
        data: null,
        headers: {
          'X-Reality-Version': String(maxVersion),
        },
        status: 304,
        modified: false,
      };
    }

    // Fetch payloads
    const payloads = new Map<string, unknown>();

    for (const key of keys) {
      if (this.config.payloadFetcher) {
        try {
          const payload = await this.config.payloadFetcher(key);
          payloads.set(key, payload);
        } catch {
          // Skip failed fetches
        }
      }
    }

    // Transform response
    const data = this.config.transform
      ? this.config.transform(payloads)
      : Object.fromEntries(payloads);

    return {
      data,
      headers: {
        'Content-Type': 'application/json',
        'X-Reality-Version': String(maxVersion),
        'Cache-Control': 'no-cache',
      },
      status: 200,
      modified: true,
    };
  }

  /**
   * Create a Fetch API handler for polling-compatible endpoint
   */
  createFetchHandler(
    getKeysFromRequest: (request: Request) => string[]
  ): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
      const ifModifiedSince = request.headers.get('X-Reality-Version');
      const version = ifModifiedSince ? parseInt(ifModifiedSince, 10) : undefined;
      const keys = getKeysFromRequest(request);

      const result = await this.handleRequest(keys, version);

      if (result.status === 304) {
        return new Response(null, {
          status: 304,
          headers: result.headers,
        });
      }

      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: result.headers,
      });
    };
  }
}

/**
 * Create polling compatibility adapter
 */
export function createPollingCompatAdapter(config: PollingCompatConfig): PollingCompatAdapter {
  return new PollingCompatAdapter(config);
}
