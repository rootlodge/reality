import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { E as EventStore, B as BloomRealityFilter } from '../store-PZHRk63Z.js';
import { R as RealityEvent } from '../event-YpV_QVIZ.js';
import 'zod';

interface RealityServerOptions {
    port?: number;
    namespace?: string;
    peers?: string[];
    storage?: 'memory';
    priority?: 'high' | 'low';
}
declare function createRealityServer(options: RealityServerOptions): {
    start: () => void;
    stop: () => http.Server<typeof IncomingMessage, typeof ServerResponse>;
};

interface EmbeddedServerOptions {
    namespace?: string;
    hmrSafe?: boolean;
}
declare global {
    var __REALITY_STORE__: EventStore | undefined;
    var __REALITY_FILTER__: BloomRealityFilter | undefined;
}
declare function createEmbeddedRealityServer(options: EmbeddedServerOptions): {
    handleRequest: (request: Request) => Promise<Response>;
    store: EventStore;
};

interface ServerContext {
    store: EventStore;
    filter: BloomRealityFilter;
    namespace: string;
}
/**
 * Handle POST /__reality/filter
 * Receive peer's filter, return events they are missing.
 */
declare function handleFilterRequest(ctx: ServerContext, body: {
    filter: string;
    origin: string;
}): Promise<{
    events: RealityEvent[];
    serverFilter: string;
}>;
/**
 * Handle POST /__reality/events
 * Receive new events from peer.
 */
declare function handleEventsRequest(ctx: ServerContext, body: {
    events: RealityEvent[];
    origin: string;
}): Promise<{
    added: number;
}>;

export { type EmbeddedServerOptions, type RealityServerOptions, type ServerContext, createEmbeddedRealityServer, createRealityServer, handleEventsRequest, handleFilterRequest };
