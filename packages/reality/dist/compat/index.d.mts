import { t as RealityClient, S as SyncHint } from '../reality-client-BNAXUCZb.mjs';
import 'zod';

/**
 * @rootlodge/reality - SSE Compatibility Layer
 *
 * Drop-in replacement for EventSource that uses the Reality system internally.
 * Allows migration from SSE to Reality with minimal code changes.
 */

/**
 * SSE message event compatible with native EventSource
 */
interface SSEMessageEvent {
    data: string;
    lastEventId: string;
    origin: string;
    type: string;
}
/**
 * SSE event listener type
 */
type SSEEventListener = (event: SSEMessageEvent) => void;
/**
 * SSE ready states compatible with native EventSource
 */
declare const SSEReadyState: {
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSED: 2;
};
/**
 * Options for createEventSource
 */
interface EventSourceOptions {
    /** Reality key to subscribe to */
    realityKey?: string;
    /** Transform server data to SSE message format */
    transform?: (data: unknown) => string;
    /** Stale time in ms - triggers sync when exceeded */
    staleTime?: number;
}
/**
 * EventSource-compatible class backed by Reality
 *
 * This provides API compatibility with native EventSource,
 * but uses Reality's deterministic pull mechanism internally.
 *
 * @example
 * ```typescript
 * // Before (native SSE):
 * const es = new EventSource('/events');
 * es.onmessage = (e) => updateUI(JSON.parse(e.data));
 *
 * // After (Reality-backed):
 * import { createEventSource } from '@rootlodge/reality/compat';
 *
 * const es = createEventSource('/events');
 * es.onmessage = (e) => updateUI(JSON.parse(e.data)); // Same API!
 * ```
 */
declare class RealityEventSource {
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSED: 2;
    readyState: number;
    url: string;
    withCredentials: boolean;
    onopen: ((event: Event) => void) | null;
    onmessage: SSEEventListener | null;
    onerror: ((event: Event) => void) | null;
    private client;
    private realityKey;
    private transform;
    private unsubscribe;
    private eventListeners;
    private lastEventId;
    constructor(url: string, client: RealityClient, options?: EventSourceOptions);
    /**
     * Add event listener (EventSource API)
     */
    addEventListener(type: string, listener: SSEEventListener): void;
    /**
     * Remove event listener (EventSource API)
     */
    removeEventListener(type: string, listener: SSEEventListener): void;
    /**
     * Dispatch event to listeners
     */
    private dispatchEvent;
    /**
     * Close the connection (EventSource API)
     */
    close(): void;
    /**
     * Connect to Reality node
     */
    private connect;
    /**
     * Handle Reality state changes
     */
    private handleStateChange;
    /**
     * Convert URL to Reality key
     */
    private urlToKey;
}
/**
 * Create an EventSource-compatible object backed by Reality
 *
 * This is the primary migration helper for SSE applications.
 *
 * @param url - The original SSE URL (used as key basis)
 * @param client - Reality client instance
 * @param options - Configuration options
 * @returns EventSource-compatible object
 *
 * @example
 * ```typescript
 * // Migration: Replace EventSource with createEventSource
 *
 * // OLD:
 * const es = new EventSource('/api/events');
 * es.onmessage = (e) => handleUpdate(JSON.parse(e.data));
 *
 * // NEW:
 * const client = createRealityClient({ servers: ['https://api.example.com'] });
 * const es = createEventSource('/api/events', client);
 * es.onmessage = (e) => handleUpdate(JSON.parse(e.data)); // Same handler!
 * ```
 */
declare function createEventSource(url: string, client: RealityClient, options?: EventSourceOptions): RealityEventSource;
/**
 * Create a factory for EventSource objects using a shared client
 *
 * Useful when migrating multiple SSE connections.
 *
 * @param client - Reality client instance
 * @returns Factory function that creates EventSource objects
 *
 * @example
 * ```typescript
 * const client = createRealityClient({ servers: ['https://api.example.com'] });
 * const EventSource = createEventSourceFactory(client);
 *
 * // Use just like native EventSource
 * const es1 = new EventSource('/events/chat');
 * const es2 = new EventSource('/events/notifications');
 * ```
 */
declare function createEventSourceFactory(client: RealityClient): new (url: string, options?: EventSourceOptions) => RealityEventSource;

/**
 * @rootlodge/reality - Polling Compatibility Layer
 *
 * Drop-in replacement for setInterval-based polling that uses Reality.
 * Eliminates wasteful periodic network requests.
 */

/**
 * Callback for polling adapter
 */
type PollingCallback<T = unknown> = (data: T) => void;
/**
 * Options for polling adapter
 */
interface PollingAdapterOptions<T = unknown> {
    /** Reality key to subscribe to */
    realityKey?: string;
    /** Transform data before passing to callback */
    transform?: (data: unknown) => T;
    /** Validation schema (zod) */
    schema?: {
        safeParse: (data: unknown) => {
            success: boolean;
            data?: T;
            error?: unknown;
        };
    };
    /** Initial data / fallback */
    initial?: T;
    /** Sync on visibility change */
    syncOnVisibility?: boolean;
    /** Sync on focus */
    syncOnFocus?: boolean;
    /** Sync on interaction hint */
    syncOnInteraction?: boolean;
}
/**
 * Polling adapter control object
 */
interface PollingAdapterControl {
    /** Manually trigger a sync */
    sync: (hint?: SyncHint) => Promise<void>;
    /** Stop the adapter */
    stop: () => void;
    /** Check if adapter is active */
    isActive: () => boolean;
    /** Get last sync timestamp */
    getLastSyncTime: () => number | null;
}
/**
 * Create a polling adapter that uses Reality instead of setInterval
 *
 * This is the primary migration helper for polling-based applications.
 * Instead of making periodic requests, it syncs only when meaningful:
 * - User interaction
 * - Window focus/visibility
 * - Optimistic mutations
 * - Idle callbacks
 *
 * @param url - The original polling endpoint (used as key basis)
 * @param callback - Function to call with updates (same as polling callback)
 * @param client - Reality client instance
 * @param options - Configuration options
 * @returns Control object for the adapter
 *
 * @example
 * ```typescript
 * // BEFORE (wasteful polling):
 * setInterval(async () => {
 *   const data = await fetch('/updates').then(r => r.json());
 *   updateUI(data);
 * }, 1000);
 *
 * // AFTER (Reality):
 * const client = createRealityClient({ servers: ['https://api.example.com'] });
 * const adapter = createPollingAdapter('/updates', updateUI, client);
 *
 * // Optionally trigger manual sync:
 * document.getElementById('refresh').onclick = () => adapter.sync();
 *
 * // Cleanup when done:
 * adapter.stop();
 * ```
 */
declare function createPollingAdapter<T = unknown>(url: string, callback: PollingCallback<T>, client: RealityClient, options?: PollingAdapterOptions<T>): PollingAdapterControl;
/**
 * Create a batch polling adapter for multiple endpoints
 *
 * Useful when migrating apps that poll multiple endpoints.
 * All endpoints are batched into a single sync request.
 *
 * @param configs - Array of polling configurations
 * @param client - Reality client instance
 * @returns Batch control object
 *
 * @example
 * ```typescript
 * const client = createRealityClient({ servers: ['https://api.example.com'] });
 *
 * const batch = createBatchPollingAdapter([
 *   { url: '/api/users', callback: updateUsers },
 *   { url: '/api/stats', callback: updateStats },
 *   { url: '/api/notifications', callback: updateNotifications },
 * ], client);
 *
 * // Sync all at once
 * batch.syncAll();
 *
 * // Stop all
 * batch.stopAll();
 * ```
 */
declare function createBatchPollingAdapter<T = unknown>(configs: Array<{
    url: string;
    callback: PollingCallback<T>;
    options?: PollingAdapterOptions<T>;
}>, client: RealityClient): {
    adapters: Map<string, PollingAdapterControl>;
    syncAll: (hint?: SyncHint) => Promise<void>;
    stopAll: () => void;
};
/**
 * Interaction-triggered sync helper
 *
 * Wraps a callback to trigger sync on interaction.
 *
 * @example
 * ```typescript
 * const control = createPollingAdapter('/data', updateUI, client);
 *
 * // Trigger sync when user clicks
 * button.onclick = withInteractionSync(control, () => {
 *   console.log('User clicked, syncing...');
 * });
 * ```
 */
declare function withInteractionSync(control: PollingAdapterControl, callback?: () => void): () => void;

export { type EventSourceOptions, type PollingAdapterControl, type PollingAdapterOptions, type PollingCallback, RealityEventSource, type SSEEventListener, type SSEMessageEvent, SSEReadyState, createBatchPollingAdapter, createEventSource, createEventSourceFactory, createPollingAdapter, withInteractionSync };
