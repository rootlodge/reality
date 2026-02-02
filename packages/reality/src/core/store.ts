import { RealityEvent } from './event';

export interface StoreOptions {
  maxEvents?: number;
  ttl?: number; // Time to live in ms
}

export class EventStore {
  private events: RealityEvent[] = [];
  private knownIds: Set<string> = new Set();
  private maxEvents: number;
  private ttl: number;

  constructor(options: StoreOptions = {}) {
    this.maxEvents = options.maxEvents ?? 10000;
    this.ttl = options.ttl ?? 24 * 60 * 60 * 1000; // 24 hours default
  }

  /**
   * Add an event to the store.
   * Returns true if event was new, false if duplicate.
   */
  add(event: RealityEvent): boolean {
    if (this.knownIds.has(event.id)) {
      return false;
    }

    // Insert sorted by timestamp (simple append usually fits if clocks roughly sync)
    // For now, strict append is fine, we can sort on retrieval if needed
    this.events.push(event);
    this.knownIds.add(event.id);

    // Prune if needed
    if (this.events.length > this.maxEvents) {
      this.gc();
    }

    return true;
  }

  /**
   * Check if we have an event
   */
  has(id: string): boolean {
    return this.knownIds.has(id);
  }

  /**
   * Get all events
   */
  getAll(): RealityEvent[] {
    return this.events;
  }

  /**
   * Get events not present in the provided check function (Filter)
   */
  getMissing(hasIt: (id: string) => boolean): RealityEvent[] {
    // Return events that the OTHER party does NOT have
    const missing: RealityEvent[] = [];
    for (const event of this.events) {
      if (!hasIt(event.id)) {
        missing.push(event);
      }
    }
    return missing;
  }

  /**
   * Garbage Collection
   * Remove old events or exceed limit
   */
  private gc() {
    const now = Date.now();
    
    // 1. TTL Pruning
    // 2. Size Pruning
    
    // Efficient approach: Filter in place
    // But Array.filter creates new array. splice is better for huge arrays at start.
    
    // Find split point for TTL
    // assuming rough time order
    
    // Simple implementation: Strict Limit Enforcement
    if (this.events.length > this.maxEvents) {
      const excess = this.events.length - this.maxEvents;
      const removed = this.events.splice(0, excess);
      for (const ev of removed) {
        this.knownIds.delete(ev.id);
      }
    }
  }

  /**
   * Clear store
   */
  clear() {
    this.events = [];
    this.knownIds.clear();
  }
}
