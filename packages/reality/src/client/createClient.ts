import { EventStore } from '../core/store';
import { BloomRealityFilter } from '../core/filter';
import { RealityEvent } from '../core/event';
import { HttpTransport, RealityTransport } from './transport';
import { nanoid } from 'nanoid';
import EventEmitter from 'eventemitter3';

export interface RealityClientOptions {
  peers?: string[];
  namespace?: string;
  transport?: RealityTransport; // Custom transport override
  autoSync?: boolean;
}

export class RealityClient extends EventEmitter {
  private store: EventStore;
  private filter: BloomRealityFilter;
  private transports: RealityTransport[] = [];
  private syncTimer: any;
  private isSyncing = false;
  private clientId: string;

  constructor(options: RealityClientOptions = {}) {
    super();
    this.store = new EventStore();
    this.filter = new BloomRealityFilter(); // Local knowledge
    this.clientId = nanoid();

    if (options.transport) {
      this.transports.push(options.transport);
    } else if (options.peers) {
      this.transports = options.peers.map(p => {
        // Normalize URL to include /__reality prefix if not customized? 
        // Spec says server handles /__reality. Client typically configured with base URL.
        // direct peer URL
        return new HttpTransport(p);
      });
    }

    if (options.autoSync !== false) {
      this.startSyncLoop();
    }
  }

  /**
   * Publish an event
   */
  publish(topic: string, payload: unknown) {
    const event: RealityEvent = {
      id: nanoid(),
      topic,
      payload,
      timestamp: Date.now(),
      origin: this.clientId,
    };

    if (this.store.add(event)) {
      this.filter.add(event.id);
      this.emit(topic, event);
      this.emit('*', event);
    }
  }

  /**
   * Subscribe to a topic (alias for on)
   */
  subscribe(topic: string, cb: (event: RealityEvent) => void) {
    this.on(topic, cb);
    
    // Replay existing events for this topic?
    // Reality 1.0 didn't, but usually good for "state".
    // For "Events", maybe not.
    // Let's stick to valid Event Emitter behavior (future events).
    // If user wants state, they can query store.
    return () => this.off(topic, cb);
  }

  /**
   * Get current events for topic
   */
  getEvents(topic: string): RealityEvent[] {
    return this.store.getAll().filter(e => e.topic === topic);
  }

  /**
   * Sync Loop
   */
  private startSyncLoop() {
    const jitter = Math.random() * 500 + 500; // 500-1000ms
    this.syncTimer = setTimeout(() => {
      this.sync().finally(() => {
        this.startSyncLoop();
      });
    }, jitter);
  }

  async sync() {
    if (this.isSyncing) return;
    if (this.transports.length === 0) return;

    this.isSyncing = true;
    try {
      // Pick random peer
      const transport = this.transports[Math.floor(Math.random() * this.transports.length)];

      // 1. Send Filter -> Get Missing Events + Server Filter
      const { events, serverFilter } = await transport.sendFilter(this.filter.serialize());

      // 2. Add received events
      let newCount = 0;
      for (const event of events) {
        if (this.store.add(event)) {
          this.filter.add(event.id);
          this.emit(event.topic, event);
          this.emit('*', event);
          newCount++;
        }
      }

      // 3. Diff Server Filter -> Find what Server is missing
      // We check OUR store against SERVER filter
      const serverBloom = BloomRealityFilter.from(serverFilter);
      const missingOnServer = this.store.getMissing((id) => serverBloom.has(id));

      if (missingOnServer.length > 0) {
        // 4. Send events server is missing
        await transport.sendEvents(missingOnServer);
      }
      
      // console.log(`[Reality] Sync: Recv ${newCount}, Sent ${missingOnServer.length}`);

    } catch (e) {
      console.warn('[Reality] Sync failed:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  stop() {
    clearTimeout(this.syncTimer);
  }
}

export function createRealityClient(options: RealityClientOptions) {
  return new RealityClient(options);
}
