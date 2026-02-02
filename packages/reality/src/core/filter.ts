import { BloomFilter } from 'bloom-filters';
import { RealityFilter } from './event';

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
export class BloomRealityFilter implements RealityFilter {
  private filter: BloomFilter;

  constructor(size = 1000, errorRate = 0.01) {
    // Estimate: m = ceil((n * log(p)) / log(1 / (pow(2, log(2)))));
    // k = round((m / n) * log(2));
    this.filter = BloomFilter.create(size, errorRate);
  }

  add(id: string): void {
    this.filter.add(id);
  }

  has(id: string): boolean {
    return this.filter.has(id);
  }

  serialize(): string {
    const json = this.filter.saveAsJSON();
    // Compress or encode if needed, for now JSON string is fine
    return JSON.stringify(json);
  }

  static from(serialized: string): BloomRealityFilter {
    const instance = new BloomRealityFilter();
    const json = JSON.parse(serialized);
    instance.filter = BloomFilter.fromJSON(json);
    return instance;
  }

  merge(other: RealityFilter): void {
    // Bloom filters can be merged with bitwise OR if same size/seeds
    // simplified: we don't merge filters in MVP, we just replace or add items
    throw new Error('Merge not implemented for simple BloomFilter');
  }
}
