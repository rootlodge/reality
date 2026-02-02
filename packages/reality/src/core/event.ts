/**
 * Reality Event
 * The fundamental atomic unit of truth in Reality 2.0.
 */
import { z } from 'zod';

export interface RealityEvent<T = unknown> {
  id: string;              // Deterministic hash of content + timestamp
  topic: string;           // Channel/Namespace
  payload: T;              // Actual data
  timestamp: number;       // Logical/Wall clock
  origin: string;          // Node ID where event was born
}

export const RealityEventSchema = z.object({
  id: z.string(),
  topic: z.string(),
  payload: z.unknown(),
  timestamp: z.number(),
  origin: z.string(),
});

/**
 * Filter represents a probabilistic set of known event IDs.
 * Used for efficient difference calculation.
 */
export interface RealityFilter {
  add(id: string): void;
  has(id: string): boolean;
  serialize(): string;
  merge(other: RealityFilter): void;
}
