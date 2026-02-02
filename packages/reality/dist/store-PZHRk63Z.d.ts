import { b as RealityFilter, R as RealityEvent } from './event-YpV_QVIZ.js';

/**
 * Filter implementation using Bloom Filters.
 * Probabilistic set:
 * - False positives possible (might say "I have this event" when I don't)
 * - False negatives IMPOSSIBLE (never says "I don't have this" if I do)
 *
 * This is safe for sync because if I falsely claim to have an event,
 * I just miss receiving it this round. Next round with a fresh/different filter
 * (or just random chance) likely fixes it. Or explicit "fill gaps" mechanism.
 *
 * Actually, for Reality 2.0, false positives in "Have" filter = Missing Data permanently if not careful.
 *
 * BUT: The gossip protocol sends "Here is my filter (what I have)".
 * Peer checks: "Do I have anything NOT in this filter?"
 * If Peer has Event E, and Filter says "Yes I have E" (False Positive), peer won't send E.
 *
 * To mitigate:
 * 1. Low error rate configuration.
 * 2. Periodic full-sync or "I'm missing X" explicit requests if gaps detected.
 * 3. Or use Invertible Bloom Lookup Tables (IBLT) for exact reconciliation (advanced).
 *
 * For Reality 2.0 MVP, we use standard Bloom Filter with conservative sizing.
 */
declare class BloomRealityFilter implements RealityFilter {
    private filter;
    constructor(size?: number, errorRate?: number);
    add(id: string): void;
    has(id: string): boolean;
    serialize(): string;
    static from(serialized: string): BloomRealityFilter;
    merge(other: RealityFilter): void;
}

interface StoreOptions {
    maxEvents?: number;
    ttl?: number;
}
declare class EventStore {
    private events;
    private knownIds;
    private maxEvents;
    private ttl;
    constructor(options?: StoreOptions);
    /**
     * Add an event to the store.
     * Returns true if event was new, false if duplicate.
     */
    add(event: RealityEvent): boolean;
    /**
     * Check if we have an event
     */
    has(id: string): boolean;
    /**
     * Get all events
     */
    getAll(): RealityEvent[];
    /**
     * Get events not present in the provided check function (Filter)
     */
    getMissing(hasIt: (id: string) => boolean): RealityEvent[];
    /**
     * Garbage Collection
     * Remove old events or exceed limit
     */
    private gc;
    /**
     * Clear store
     */
    clear(): void;
}

export { BloomRealityFilter as B, EventStore as E, type StoreOptions as S };
