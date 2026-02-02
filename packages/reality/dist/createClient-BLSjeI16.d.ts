import { R as RealityEvent } from './event-YpV_QVIZ.js';
import EventEmitter from 'eventemitter3';

interface RealityTransport {
    sendFilter(filter: string): Promise<{
        events: RealityEvent[];
        serverFilter: string;
    }>;
    sendEvents(events: RealityEvent[]): Promise<{
        added: number;
    }>;
}
declare class HttpTransport implements RealityTransport {
    private url;
    constructor(url: string);
    sendFilter(filter: string): Promise<{
        events: RealityEvent[];
        serverFilter: string;
    }>;
    sendEvents(events: RealityEvent[]): Promise<{
        added: number;
    }>;
}

interface RealityClientOptions {
    peers?: string[];
    namespace?: string;
    transport?: RealityTransport;
    autoSync?: boolean;
}
declare class RealityClient extends EventEmitter {
    private store;
    private filter;
    private transports;
    private syncTimer;
    private isSyncing;
    private clientId;
    constructor(options?: RealityClientOptions);
    /**
     * Publish an event
     */
    publish(topic: string, payload: unknown): void;
    /**
     * Subscribe to a topic (alias for on)
     */
    subscribe(topic: string, cb: (event: RealityEvent) => void): () => this;
    /**
     * Get current events for topic
     */
    getEvents(topic: string): RealityEvent[];
    /**
     * Sync Loop
     */
    private startSyncLoop;
    sync(): Promise<void>;
    stop(): void;
}
declare function createRealityClient(options: RealityClientOptions): RealityClient;

export { HttpTransport as H, RealityClient as R, type RealityClientOptions as a, type RealityTransport as b, createRealityClient as c };
