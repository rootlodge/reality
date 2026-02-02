import { RealityEvent } from './event';
import { BloomRealityFilter } from './filter';

export interface GossipMessage {
  type: 'filter' | 'events';
  payload: string | RealityEvent[];
  origin: string;
}

export function createFilterMessage(origin: string, filter: BloomRealityFilter): GossipMessage {
  return {
    type: 'filter',
    payload: filter.serialize(),
    origin,
  };
}

export function createEventsMessage(origin: string, events: RealityEvent[]): GossipMessage {
  return {
    type: 'events',
    payload: events,
    origin,
  };
}
