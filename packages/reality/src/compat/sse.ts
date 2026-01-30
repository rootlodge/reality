/**
 * @rootlodge/reality - SSE Compatibility Layer
 * 
 * Drop-in replacement for EventSource that uses the Reality system internally.
 * Allows migration from SSE to Reality with minimal code changes.
 */

import type { RealityKeyOptions, RealityNodeState } from '../types';
import { RealityClient } from '../client/reality-client';

/**
 * SSE message event compatible with native EventSource
 */
export interface SSEMessageEvent {
  data: string;
  lastEventId: string;
  origin: string;
  type: string;
}

/**
 * SSE event listener type
 */
export type SSEEventListener = (event: SSEMessageEvent) => void;

/**
 * SSE ready states compatible with native EventSource
 */
export const SSEReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
} as const;

/**
 * Options for createEventSource
 */
export interface EventSourceOptions {
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
export class RealityEventSource {
  // EventSource API compatibility
  readonly CONNECTING = SSEReadyState.CONNECTING;
  readonly OPEN = SSEReadyState.OPEN;
  readonly CLOSED = SSEReadyState.CLOSED;

  readyState: number = SSEReadyState.CONNECTING;
  url: string;
  withCredentials = false;

  onopen: ((event: Event) => void) | null = null;
  onmessage: SSEEventListener | null = null;
  onerror: ((event: Event) => void) | null = null;

  private client: RealityClient;
  private realityKey: string;
  private transform: (data: unknown) => string;
  private unsubscribe: (() => void) | null = null;
  private eventListeners: Map<string, Set<SSEEventListener>> = new Map();
  private lastEventId = '';

  constructor(
    url: string,
    client: RealityClient,
    options: EventSourceOptions = {}
  ) {
    this.url = url;
    this.client = client;
    this.realityKey = options.realityKey ?? this.urlToKey(url);
    this.transform = options.transform ?? JSON.stringify;

    // Subscribe to Reality node
    this.connect(options);
  }

  /**
   * Add event listener (EventSource API)
   */
  addEventListener(type: string, listener: SSEEventListener): void {
    let listeners = this.eventListeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(type, listeners);
    }
    listeners.add(listener);
  }

  /**
   * Remove event listener (EventSource API)
   */
  removeEventListener(type: string, listener: SSEEventListener): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Dispatch event to listeners
   */
  private dispatchEvent(type: string, event: SSEMessageEvent): void {
    // Call specific handler
    if (type === 'message' && this.onmessage) {
      this.onmessage(event);
    }

    // Call registered listeners
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  /**
   * Close the connection (EventSource API)
   */
  close(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.readyState = SSEReadyState.CLOSED;
  }

  /**
   * Connect to Reality node
   */
  private connect(options: EventSourceOptions): void {
    const keyOptions: RealityKeyOptions = {
      staleTime: options.staleTime ?? 30000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    };

    this.unsubscribe = this.client.subscribe(
      this.realityKey,
      (state: RealityNodeState) => {
        this.handleStateChange(state);
      },
      keyOptions
    );
  }

  /**
   * Handle Reality state changes
   */
  private handleStateChange(state: RealityNodeState): void {
    // Handle connection state
    if (this.readyState === SSEReadyState.CONNECTING && !state.isLoading) {
      this.readyState = SSEReadyState.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }

    // Handle errors
    if (state.error) {
      if (this.onerror) {
        this.onerror(new Event('error'));
      }
      return;
    }

    // Handle data updates
    if (state.data !== undefined && state.meta) {
      const eventId = `${state.meta.version}-${state.meta.hash}`;
      
      // Only emit if this is a new event
      if (eventId !== this.lastEventId) {
        this.lastEventId = eventId;
        
        const event: SSEMessageEvent = {
          data: this.transform(state.data),
          lastEventId: eventId,
          origin: this.url,
          type: 'message',
        };

        this.dispatchEvent('message', event);
      }
    }
  }

  /**
   * Convert URL to Reality key
   */
  private urlToKey(url: string): string {
    // Remove protocol and query params, convert to key format
    return url
      .replace(/^https?:\/\/[^/]+/, '')
      .replace(/\?.*$/, '')
      .replace(/^\//, '')
      .replace(/\//g, ':');
  }
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
export function createEventSource(
  url: string,
  client: RealityClient,
  options: EventSourceOptions = {}
): RealityEventSource {
  return new RealityEventSource(url, client, options);
}

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
export function createEventSourceFactory(
  client: RealityClient
): new (url: string, options?: EventSourceOptions) => RealityEventSource {
  return class extends RealityEventSource {
    constructor(url: string, options?: EventSourceOptions) {
      super(url, client, options);
    }
  };
}
