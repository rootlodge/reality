# @rootlodge/reality-server

**Server package for Reality - Socketless Real-Time Infrastructure**

> Stateless HTTP handlers with mesh-aware coordination.

## Installation

```bash
npm install @rootlodge/reality-server
```

## Quick Start

```typescript
import { 
  RealityServer, 
  MemoryStorage, 
  createFetchHandler,
  createExpressAdapter 
} from '@rootlodge/reality-server';

// 1. Create storage adapter
const storage = new MemoryStorage();

// 2. Create server instance
const server = new RealityServer({
  storage,
  serverId: 'server-1',           // Unique per instance
  meshPeers: [],                  // Other server URLs for mesh
  redis: undefined,               // Optional Redis for acceleration
});

// 3. Create HTTP handler
const handler = createFetchHandler(server);

// 4. Mount on your framework
// Fetch API (Bun, Deno, Cloudflare Workers)
app.post('/reality/sync', handler);

// Express/Fastify
app.post('/reality/sync', createExpressAdapter(server));

// 5. Update nodes when data changes
await server.updateNode('chat:room:general', hashOfCurrentState);
```

## Storage Adapters

### Memory Storage (Development)

```typescript
import { MemoryStorage } from '@rootlodge/reality-server';

const storage = new MemoryStorage();
```

### SQL Storage (PostgreSQL, MySQL, SQLite)

```typescript
import { SQLStorage } from '@rootlodge/reality-server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const storage = new SQLStorage({
  query: (sql, params) => pool.query(sql, params).then(r => r.rows),
  dialect: 'postgres', // 'postgres' | 'mysql' | 'sqlite'
});
```

### Drizzle Adapter

```typescript
import { createDrizzleAdapter } from '@rootlodge/reality-server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const storage = createDrizzleAdapter(db, {
  tableName: 'reality_nodes',
});
```

### Prisma Adapter

```typescript
import { createPrismaAdapter } from '@rootlodge/reality-server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const storage = createPrismaAdapter(prisma, {
  modelName: 'RealityNode',
});
```

### DynamoDB Adapter

```typescript
import { DynamoDBStorage } from '@rootlodge/reality-server';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDB({ region: 'us-east-1' });
const storage = new DynamoDBStorage({
  client: dynamodb,
  tableName: 'reality-nodes',
});
```

## Server Options

```typescript
const server = new RealityServer({
  // Required
  storage: Storage,              // Storage adapter instance
  
  // Optional
  serverId: string,              // Unique server ID (auto-generated if not provided)
  meshPeers: string[],           // URLs of other servers for mesh coordination
  redis: {                       // Optional Redis for pub/sub acceleration
    publisher: RedisClient,
    subscriber: RedisClient,
    channel: 'reality:updates',
  },
  onError: (error) => void,      // Error handler
});
```

## Updating Nodes

When your application data changes, update the corresponding Reality node:

```typescript
// After adding a message
room.messages.push(newMessage);

// Update the Reality node with a hash of the current state
const hash = createHash(JSON.stringify(room.messages.map(m => m.id)));
await server.updateNode('chat:room:general', hash);

// Clients subscribed to 'chat:room:general' will detect the change on next sync
```

### Hash Strategy

The hash should change whenever the underlying data changes. Options:

```typescript
// Option 1: Hash of IDs (fast, detects additions/deletions)
const hash = createHash(items.map(i => i.id).join(','));

// Option 2: Hash of content (detects all changes)
const hash = createHash(JSON.stringify(items));

// Option 3: Timestamp (simple, always changes)
const hash = String(Date.now());

// Option 4: Version counter (from database)
const hash = String(record.version);
```

## HTTP Protocol

### Request

```http
POST /reality/sync HTTP/1.1
Content-Type: application/json

{
  "known": {
    "chat:room:general": 5,
    "user:profile:123": 2
  }
}
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "changed": {
    "chat:room:general": {
      "key": "chat:room:general",
      "version": 6,
      "hash": "abc123",
      "updatedAt": 1699876543210
    }
  },
  "mesh": {
    "peers": ["server-2", "server-3"],
    "serverVersion": 1
  }
}
```

## Mesh Coordination

For multi-server deployments, servers gossip peer information:

```typescript
const server1 = new RealityServer({
  storage: storage1,
  serverId: 'server-1',
  meshPeers: ['http://server-2:3000', 'http://server-3:3000'],
});

const server2 = new RealityServer({
  storage: storage2,
  serverId: 'server-2',
  meshPeers: ['http://server-1:3000', 'http://server-3:3000'],
});
```

Mesh info is piggybacked on normal requests - no additional connections needed.

## Redis Acceleration (Optional)

For faster cross-server propagation:

```typescript
import Redis from 'ioredis';

const publisher = new Redis(process.env.REDIS_URL);
const subscriber = new Redis(process.env.REDIS_URL);

const server = new RealityServer({
  storage,
  serverId: 'server-1',
  redis: {
    publisher,
    subscriber,
    channel: 'reality:updates',
  },
});
```

**Important:** Redis is for acceleration only. The system MUST work correctly without it.

## Framework Adapters

### Fetch API (Bun, Deno, Workers)

```typescript
import { createFetchHandler } from '@rootlodge/reality-server';

const handler = createFetchHandler(server);

// Bun
Bun.serve({
  fetch(req) {
    if (new URL(req.url).pathname === '/reality/sync') {
      return handler(req);
    }
    return new Response('Not Found', { status: 404 });
  },
});
```

### Express

```typescript
import { createExpressAdapter } from '@rootlodge/reality-server';
import express from 'express';

const app = express();
app.use(express.json());
app.post('/reality/sync', createExpressAdapter(server));
```

### Fastify

```typescript
import { createFetchHandler } from '@rootlodge/reality-server';

fastify.post('/reality/sync', async (request, reply) => {
  const response = await createFetchHandler(server)(
    new Request('http://localhost/reality/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request.body),
    })
  );
  reply.status(response.status).send(await response.json());
});
```

## SSE Compatibility

For gradual migration from SSE:

```typescript
// Server-side SSE compatibility endpoint
app.get('/events', async (req, res) => {
  const response = await server.handleSSECompat(req, {
    keys: ['notifications:all'],
    heartbeatInterval: 30000,
  });
  // Stream response to client
});
```

## API Reference

### `RealityServer`

```typescript
class RealityServer {
  constructor(options: RealityServerOptions);
  
  // Update a node's version
  updateNode(key: string, hash: string): Promise<void>;
  
  // Get node metadata
  getNode(key: string): Promise<RealityNodeMeta | null>;
  
  // Handle sync request
  handleSync(request: SyncRequest): Promise<SyncResponse>;
  
  // Get mesh peers
  getMeshPeers(): Promise<string[]>;
  
  // Get server stats
  getStats(): Promise<ServerStats>;
  
  // SSE compatibility handler
  handleSSECompat(request: Request, options: SSEOptions): Promise<Response>;
}
```

### Storage Interface

All storage adapters implement:

```typescript
interface RealityStorage {
  getNode(key: string): Promise<RealityNodeMeta | null>;
  setNode(key: string, meta: RealityNodeMeta): Promise<void>;
  incrementVersion(key: string): Promise<number>;
  listChangedSince(version: number): Promise<RealityNodeMeta[]>;
  getNodes(keys: string[]): Promise<Map<string, RealityNodeMeta>>;
  getMaxVersion(): Promise<number>;
  deleteNode(key: string): Promise<void>;
  isHealthy(): Promise<boolean>;
}
```

## License

MIT
