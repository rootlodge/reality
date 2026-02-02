import { EventStore } from '../core/store';
import { BloomRealityFilter } from '../core/filter';
import { RealityEvent } from '../core/event';
import { nanoid } from 'nanoid';

export interface ServerContext {
  store: EventStore;
  filter: BloomRealityFilter; // Current server state filter
  namespace: string;
}

/**
 * Handle POST /__reality/filter
 * Receive peer's filter, return events they are missing.
 */
export async function handleFilterRequest(
  ctx: ServerContext,
  body: { filter: string; origin: string }
): Promise<{ events: RealityEvent[]; serverFilter: string }> {
  // 1. Reconstruct peer filter
  const peerFilter = BloomRealityFilter.from(body.filter);

  // 2. Find events we have that they miss
  // We iterate our store and check if peerFilter.has(id)
  const missingEvents = ctx.store.getMissing((id) => peerFilter.has(id));

  // 3. Return events + our current filter (so they can send us what we miss)
  return {
    events: missingEvents,
    serverFilter: ctx.filter.serialize(),
  };
}

/**
 * Handle POST /__reality/events
 * Receive new events from peer.
 */
export async function handleEventsRequest(
  ctx: ServerContext,
  body: { events: RealityEvent[]; origin: string }
): Promise<{ added: number }> {
  let added = 0;
  
  for (const event of body.events) {
    if (ctx.store.add(event)) {
      ctx.filter.add(event.id);
      added++;
    }
  }

  return { added };
}
