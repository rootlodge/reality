import { createRealityServer } from '@rootlodge/reality/server';

const server = createRealityServer({
  port: 8787,
  namespace: 'vite-example',
  storage: 'memory'
});

server.start();
