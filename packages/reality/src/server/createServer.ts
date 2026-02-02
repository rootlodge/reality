import { createServer, IncomingMessage, ServerResponse } from 'http';
import { EventStore } from '../core/store';
import { BloomRealityFilter } from '../core/filter';
import { handleEventsRequest, handleFilterRequest } from './http';

export interface RealityServerOptions {
  port?: number;
  namespace?: string;
  peers?: string[]; // peers to gossip with (outbound) - TODO implement outbound gossip
  storage?: 'memory';
  priority?: 'high' | 'low';
}

export function createRealityServer(options: RealityServerOptions) {
  const store = new EventStore();
  const filter = new BloomRealityFilter();
  const namespace = options.namespace || 'default';

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    
    // Simple body parser
    const body = await new Promise<any>((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({});
        }
      });
    });

    try {
      if (url.pathname === '/__reality/filter') {
        const result = await handleFilterRequest({ store, filter, namespace }, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (url.pathname === '/__reality/events') {
        const result = await handleEventsRequest({ store, filter, namespace }, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    } catch (error) {
      console.error(error);
      res.writeHead(500);
      res.end('Internal Error');
    }
  });

  const port = options.port || 8787;
  
  return {
    start: () => {
      server.listen(port, () => {
        console.log(`Reality Server 2.0 running on port ${port}`);
        console.log(`Namespace: ${namespace}`);
      });
    },
    stop: () => server.close()
  };
}
