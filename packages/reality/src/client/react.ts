import { useEffect, useState, useMemo } from 'react';
import { RealityClient, RealityClientOptions, createRealityClient } from './createClient';
import { RealityEvent } from '../core/event';

// Global Singleton for React context-less usage (simplest API)
let globalClient: RealityClient | null = null;

export function useRealityClient(options?: RealityClientOptions) {
  // If options provided, create/update global client
  // Caution: Changing options re-creates client
  const client = useMemo(() => {
    if (options) {
      if (globalClient) globalClient.stop();
      globalClient = createRealityClient(options);
    }
    return globalClient;
  }, [JSON.stringify(options)]);

  return client;
}

export function useReality(topic: string, clientOverride?: RealityClient) {
  const client = clientOverride || globalClient;
  if (!client) {
    throw new Error('Reality Client not initialized. Call createRealityClient() or useRealityClient() first.');
  }

  const [events, setEvents] = useState<RealityEvent[]>(() => client.getEvents(topic));

  useEffect(() => {
    // Initial fetch from store to catch up
    setEvents(client.getEvents(topic));

    const handler = (event: RealityEvent) => {
      setEvents(prev => [...prev, event]);
    };

    client.on(topic, handler);
    return () => {
      client.off(topic, handler);
    };
  }, [client, topic]);

  const publish = (payload: unknown) => {
    client.publish(topic, payload);
  };

  return { events, publish };
}
