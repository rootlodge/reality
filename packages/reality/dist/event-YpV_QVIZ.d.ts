import { z } from 'zod';

/**
 * Reality Event
 * The fundamental atomic unit of truth in Reality 2.0.
 */

interface RealityEvent<T = unknown> {
    id: string;
    topic: string;
    payload: T;
    timestamp: number;
    origin: string;
}
declare const RealityEventSchema: z.ZodObject<{
    id: z.ZodString;
    topic: z.ZodString;
    payload: z.ZodUnknown;
    timestamp: z.ZodNumber;
    origin: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    topic: string;
    timestamp: number;
    origin: string;
    payload?: unknown;
}, {
    id: string;
    topic: string;
    timestamp: number;
    origin: string;
    payload?: unknown;
}>;
/**
 * Filter represents a probabilistic set of known event IDs.
 * Used for efficient difference calculation.
 */
interface RealityFilter {
    add(id: string): void;
    has(id: string): boolean;
    serialize(): string;
    merge(other: RealityFilter): void;
}

export { type RealityEvent as R, RealityEventSchema as a, type RealityFilter as b };
