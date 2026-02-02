import { EventStore } from '../core/store';
import { BloomRealityFilter } from '../core/filter';
import { handleEventsRequest, handleFilterRequest } from './http';

export interface EmbeddedServerOptions {
  namespace?: string;
  hmrSafe?: boolean;
}

// Global singleton for HMR safety if needed
declare global {
  var __REALITY_STORE__: EventStore | undefined;
  var __REALITY_FILTER__: BloomRealityFilter | undefined;
}

export function createEmbeddedRealityServer(options: EmbeddedServerOptions) {
  const namespace = options.namespace || 'default';
  
  // HMR Safety: Reuse store if exists
  let store: EventStore;
  let filter: BloomRealityFilter;

  if (options.hmrSafe && globalThis.__REALITY_STORE__) {
    // console.log('[Reality] Reusing existing store (HMR)');
    store = globalThis.__REALITY_STORE__;
    filter = globalThis.__REALITY_FILTER__!;
  } else {
    store = new EventStore();
    filter = new BloomRealityFilter();
    
    if (options.hmrSafe) {
      globalThis.__REALITY_STORE__ = store;
      globalThis.__REALITY_FILTER__ = filter;
    }
  }

  // Next.js Route Handler / Fetch Adapter
  const handleRequest = async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const body = await request.json();

      if (url.pathname.endsWith('/filter')) {
        const result = await handleFilterRequest({ store, filter, namespace }, body);
        return Response.json(result);
      }

      if (url.pathname.endsWith('/events')) {
        const result = await handleEventsRequest({ store, filter, namespace }, body);
        return Response.json(result);
      }

      return new Response('Not Found', { status: 404 });
    } catch (e) {
      console.error(e);
      return new Response('Internal Error', { status: 500 });
    }
  };

  return {
    handleRequest,
    store, // exposed for internal usage if needed
  };
}
