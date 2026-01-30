# Reality - LLM Guide for Code Generation

> This document provides a comprehensive overview of the Reality packages for LLMs generating code with these libraries.

## Package Overview

Reality is a **Socketless Real-Time Infrastructure** consisting of two packages:

| Package | Description | NPM |
|---------|-------------|-----|
| `@rootlodge/reality` | Client library with React hooks, compatibility layers, SSR support | Client/Browser/SSR |
| `@rootlodge/reality-server` | Server library with mesh coordination, storage adapters, HTTP handlers | Node.js/Bun/Deno |

## Core Philosophy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  REALITY DOES NOT OWN YOUR DATA                                        │
│                                                                         │
│  ❌ Reality does NOT store your payloads                               │
│  ❌ Reality does NOT require a database                                │
│  ❌ Reality does NOT manage your application state                     │
│                                                                         │
│  ✅ Reality tracks CHANGE METADATA (version numbers, content hashes)   │
│  ✅ Reality tells clients WHEN data changed, not WHAT changed          │
│  ✅ Your application fetches data from YOUR data source                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## How It Works

```
┌──────────┐                           ┌──────────┐
│  Client  │  POST /reality/sync       │  Server  │
│          │  { known: { key: v5 } }   │          │
│          │ ────────────────────────► │          │
│          │                           │          │
│          │  { changed: { key: v6 } } │          │
│          │ ◄──────────────────────── │          │
│          │                           │          │
│          │  GET /api/data            │  YOUR    │
│          │ ────────────────────────► │   API    │
│          │                           │          │
└──────────┘                           └──────────┘

1. Client sends: "I have version 5 of 'posts'"
2. Server replies: "There's version 6 now"  
3. Client fetches actual data from YOUR API
```

---

# @rootlodge/reality (Client Package)

## Installation

```bash
npm install @rootlodge/reality
```

## Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `'auto'` | Detects environment automatically | **Recommended for most cases** |
| `'client'` | HTTP to external Reality servers | Browser apps with dedicated backend |
| `'ssr-embedded'` | In-process embedded server | TanStack Start, Vite SSR, Next.js |
| `'server-external'` | Dedicated Reality server | Production scaling |

## Basic Client Usage

```typescript
import { createReality, createRealityClient } from '@rootlodge/reality';

// createReality and createRealityClient are aliases
const reality = createReality({
  // Server URLs (required for 'client' mode)
  servers: ['http://localhost:3456'],
  
  // Execution mode
  executionMode: 'auto', // 'auto' | 'client' | 'ssr-embedded'
  
  // Compatibility mode (usually 'native')
  mode: 'native', // 'native' | 'sse-compat' | 'polling-compat'
  
  // Optional configuration
  timeout: 10000,
  maxRetries: 3,
  retryBaseDelay: 100,
  debug: false,
});
```

## Subscribe to Changes

```typescript
// Subscribe to a single key
const unsubscribe = reality.subscribe('posts', (state) => {
  // state.data - current data (if fetcher provided)
  // state.meta - { key, version, hash, updatedAt }
  // state.status - 'idle' | 'loading' | 'syncing' | 'error' | 'stale'
  // state.error - any error
  // state.isLoading, state.isSyncing, state.isStale
  
  console.log('Posts changed:', state);
});

// Cleanup
unsubscribe();
```

## Manual Sync

```typescript
// Sync specific keys
await reality.syncKeys(['posts', 'user:123'], 'interaction');

// Sync all subscribed keys
await reality.syncAll('focus');

// Invalidate keys (triggers sync)
await reality.invalidate(['posts']);
```

## Realtime Helper

```typescript
const posts = reality.realtime<Post[]>('posts', {
  fallback: [],
  fetcher: async (key, meta) => {
    const res = await fetch('/api/posts');
    return res.json();
  },
});

// Subscribe
const unsub = posts.subscribe((state) => {
  console.log(state.data);
});

// Get current state
const currentState = posts.getState();

// Manual sync
await posts.sync('interaction');
```

## Mutations

```typescript
const result = await reality.mutate(
  'posts',
  { title: 'New Post' },
  async (input) => {
    const res = await fetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.json();
  },
  {
    // Optimistic update
    optimisticUpdate: (current, input) => [
      ...(current ?? []),
      { id: 'temp', ...input, pending: true },
    ],
    rollbackOnError: true,
    invalidateKeys: ['feed'],
  }
);
```

## React Integration

```tsx
import { 
  RealityProvider, 
  useReality, 
  useMutation,
  useRealityClient,
  useSync,
} from '@rootlodge/reality/react';

// Wrap app with provider
function App() {
  return (
    <RealityProvider
      servers={['http://localhost:3456']}
      executionMode="auto"
    >
      <MyComponent />
    </RealityProvider>
  );
}

// Use hooks
function MyComponent() {
  // Subscribe to data
  const { 
    data: posts,
    isLoading,
    isSyncing,
    error,
    sync,
  } = useReality<Post[]>('posts', {
    fallback: [],
    fetcher: async (key) => {
      const res = await fetch('/api/posts');
      return res.json();
    },
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // Mutation
  const { mutate, isLoading: isSending } = useMutation(
    'posts',
    async (text: string) => {
      // Your mutation logic
    },
    {
      optimisticUpdate: (current, text) => [...current, { text, pending: true }],
    }
  );

  // Direct client access
  const client = useRealityClient();

  // Sync controls
  const { syncAll, syncKeys } = useSync();
}
```

## SSR / TanStack Integration

```typescript
import { 
  createRealityTanStackAdapter,
  createSSRContext,
  TanStackRealityAdapter,
} from '@rootlodge/reality';

// Create adapter for SSR
const adapter = createRealityTanStackAdapter({
  keys: ['posts', 'user:123'],
  serverId: 'tanstack-ssr',
});

// In loader
async function loader() {
  // Prefetch and get hydration state
  const realityState = await adapter.prefetch();
  
  return {
    realityState,
  };
}

// Invalidate from server actions
await adapter.invalidate(['posts']);
```

## Compatibility Layers

### EventSource Replacement

```typescript
import { RealityEventSource } from '@rootlodge/reality/compat';

// Drop-in replacement for EventSource
const es = new RealityEventSource('/events', {
  realityEndpoint: '/reality/sync',
});

es.onmessage = (event) => {
  console.log(event.data);
};
```

### Polling Adapter

```typescript
import { createPollingAdapter } from '@rootlodge/reality/compat';

const adapter = createPollingAdapter({
  key: 'notifications',
  realityEndpoint: '/reality/sync',
  payloadEndpoint: '/api/notifications',
  interval: 2000,
  onData: (data) => setNotifications(data),
});

adapter.start();
// adapter.stop();
```

---

# @rootlodge/reality-server (Server Package)

## Installation

```bash
npm install @rootlodge/reality-server
```

## Basic Server Setup

```typescript
import { createRealityServer, RealityServer } from '@rootlodge/reality-server';

// Create server (uses in-memory storage by default)
const server = createRealityServer({
  serverId: 'server-1', // Required: unique ID
  
  // Optional mesh peers
  peers: ['http://server-2:3000'],
  
  // Optional CORS
  cors: {
    origins: ['http://localhost:3000'],
    credentials: true,
  },
  
  debug: false,
});

// Or use the class directly
const server = new RealityServer({
  serverId: 'server-1',
});
```

## Invalidation

```typescript
// When your data changes, tell Reality

// Single key
await server.invalidate('posts');

// Multiple keys
await server.invalidateMany(['posts', 'user:123', 'comments']);

// Update with specific hash
await server.updateNode('posts', 'hash-of-current-data');
```

## HTTP Integration

### Fetch Handler (Recommended)

```typescript
// Get a Fetch-compatible handler
const handler = server.getFetchHandler('/reality');

// With Bun
Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/reality')) {
      return handler(request);
    }
    return new Response('Not Found', { status: 404 });
  },
});

// With Cloudflare Workers
export default {
  fetch: server.getFetchHandler('/reality'),
};
```

### Express Integration

```typescript
import { createExpressMiddleware } from '@rootlodge/reality-server';
import express from 'express';

const app = express();
app.use('/reality', createExpressMiddleware(server));
app.listen(3000);
```

## Embedded Server for SSR

```typescript
import { createEmbeddedRealityServer } from '@rootlodge/reality-server';

// Create in-process server for SSR
const embedded = createEmbeddedRealityServer({
  serverId: 'ssr-server',
});

// Handle sync directly (no HTTP)
const response = await embedded.handleSync(request);

// Invalidate
await embedded.invalidate(['posts']);
```

## Storage Adapters (Optional)

Storage is **optional** - Reality works fine with in-memory only.

### Memory Storage (Default)

```typescript
import { MemoryStorage } from '@rootlodge/reality-server';

const storage = new MemoryStorage();
const server = createRealityServer({ serverId: 'server-1' }, storage);
```

### SQL Storage

```typescript
import { createSQLStorage } from '@rootlodge/reality-server';

const storage = createSQLStorage({
  executor: {
    query: async (sql, params) => {
      // Execute SQL and return rows
      return db.query(sql, params);
    },
  },
  dialect: 'postgres', // 'postgres' | 'mysql' | 'sqlite'
});
```

### Drizzle Storage

```typescript
import { createDrizzleStorage } from '@rootlodge/reality-server';

const storage = createDrizzleStorage({
  db: drizzleInstance,
  dialect: 'postgres',
});
```

### Prisma Storage

```typescript
import { createPrismaStorage } from '@rootlodge/reality-server';

const storage = createPrismaStorage({
  prisma: prismaClient,
});
```

### DynamoDB Storage

```typescript
import { createDynamoDBStorage } from '@rootlodge/reality-server';

const storage = createDynamoDBStorage({
  client: dynamoDBClient,
  tableName: 'reality-nodes',
});
```

## Invalidation Adapters (Optional)

Auto-invalidate when your database changes:

### Drizzle Auto-Invalidation

```typescript
import { createDrizzleInvalidationAdapter } from '@rootlodge/reality-server';

const adapter = createDrizzleInvalidationAdapter({
  db: drizzleInstance,
  keyExtractor: (tableName, operation, data) => {
    if (tableName === 'posts') return ['posts'];
    if (tableName === 'messages') return [`chat:room:${data.roomId}`];
    return [];
  },
});

server.setInvalidationAdapter(adapter);
```

### Prisma Auto-Invalidation

```typescript
import { createPrismaInvalidationAdapter } from '@rootlodge/reality-server';

const adapter = createPrismaInvalidationAdapter({
  prisma: prismaClient,
  keyExtractor: (model, operation, data) => {
    if (model === 'Post') return ['posts'];
    return [];
  },
});

server.setInvalidationAdapter(adapter);
```

### Callback Adapter

```typescript
import { createCallbackInvalidationAdapter } from '@rootlodge/reality-server';

const adapter = createCallbackInvalidationAdapter({
  onInvalidate: async (keys) => {
    console.log('Invalidated:', keys);
  },
});
```

## Mesh Coordination

```typescript
// Server 1
const server1 = createRealityServer({
  serverId: 'server-1',
  peers: ['http://server-2:3000', 'http://server-3:3000'],
});

// Server 2
const server2 = createRealityServer({
  serverId: 'server-2',
  peers: ['http://server-1:3000', 'http://server-3:3000'],
});

// Mesh info is automatically shared via sync responses
```

## Redis Acceleration (Optional)

```typescript
import { createRedisAccelerator } from '@rootlodge/reality-server';

const redis = createRedisAccelerator({
  redis: redisClient,
  channel: 'reality:updates',
});

server.setRedis(redis);
```

---

# Common Patterns

## Pattern 1: Basic React App

```tsx
// App.tsx
import { RealityProvider, useReality } from '@rootlodge/reality/react';

function App() {
  return (
    <RealityProvider servers={['http://localhost:3456']}>
      <PostsList />
    </RealityProvider>
  );
}

function PostsList() {
  const { data: posts, isLoading } = useReality<Post[]>('posts', {
    fallback: [],
    fetcher: () => fetch('/api/posts').then(r => r.json()),
  });

  if (isLoading) return <div>Loading...</div>;
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

## Pattern 2: Server with Express

```typescript
// server.ts
import express from 'express';
import { createRealityServer } from '@rootlodge/reality-server';

const app = express();
const reality = createRealityServer({ serverId: 'main' });

// Reality endpoint
const handler = reality.getFetchHandler('/reality');
app.all('/reality/*', async (req, res) => {
  const url = `http://localhost${req.url}`;
  const response = await handler(new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  }));
  res.status(response.status).json(await response.json());
});

// Your API
app.post('/api/posts', async (req, res) => {
  const post = await db.insert(posts).values(req.body);
  await reality.invalidate('posts'); // Tell Reality data changed
  res.json(post);
});

app.listen(3456);
```

## Pattern 3: SSR with TanStack

```typescript
// routes/posts.tsx
import { createRealityTanStackAdapter } from '@rootlodge/reality';
import { createEmbeddedRealityServer } from '@rootlodge/reality-server';

// Create embedded server once
const embedded = createEmbeddedRealityServer({ serverId: 'ssr' });

export async function loader() {
  const adapter = createRealityTanStackAdapter({ keys: ['posts'] });
  const realityState = await adapter.prefetch();
  const posts = await db.query.posts.findMany();
  
  return { posts, realityState };
}

export async function action({ request }) {
  const data = await request.formData();
  await db.insert(posts).values({ title: data.get('title') });
  await embedded.invalidate(['posts']);
  return redirect('/posts');
}
```

## Pattern 4: No Database Required

```typescript
// Reality works entirely in-memory
const server = createRealityServer({ serverId: 'demo' });

// Track changes without any database
await server.invalidate('counter');
await server.invalidate('status');

// Clients sync and discover changes
// Your app provides the actual data
```

---

# Type Reference

## Client Types

```typescript
interface RealityOptions {
  servers?: string[];
  mode?: 'native' | 'sse-compat' | 'polling-compat';
  executionMode?: 'auto' | 'client' | 'ssr-embedded' | 'server-external';
  clientId?: string;
  initialKnown?: Record<string, number>;
  timeout?: number;
  maxRetries?: number;
  retryBaseDelay?: number;
  blacklistDuration?: number;
  debug?: boolean;
}

interface RealityNodeState<T> {
  key: string;
  data: T | undefined;
  meta: RealityNodeMeta | null;
  status: 'idle' | 'loading' | 'syncing' | 'error' | 'stale';
  error: Error | null;
  isLoading: boolean;
  isSyncing: boolean;
  isStale: boolean;
  lastSyncAt: number | null;
}

interface RealityNodeMeta {
  key: string;
  version: number;
  hash: string;
  updatedAt: number;
}
```

## Server Types

```typescript
interface ServerConfig {
  serverId: string;
  peers?: string[];
  port?: number;
  host?: string;
  cors?: {
    origins?: string[];
    credentials?: boolean;
  };
  debug?: boolean;
}

interface SyncRequest {
  known: Record<string, number>;
  clientId: string;
  mode: 'native' | 'sse-compat' | 'polling-compat';
  hint: 'interaction' | 'focus' | 'idle' | 'mutation' | 'mount' | 'reconnect';
  timestamp?: number;
}

interface SyncResponse {
  changed: Record<string, ChangedNode>;
  mesh: MeshInfo;
  serverTime: number;
}
```

---

# Summary

## Key Exports from @rootlodge/reality

```typescript
// Client
export { createReality, createRealityClient, RealityClient } from '@rootlodge/reality';

// React
export { RealityProvider, useReality, useMutation, useSync } from '@rootlodge/reality/react';

// SSR
export { createRealityTanStackAdapter, createSSRContext } from '@rootlodge/reality';

// Compat
export { RealityEventSource, createPollingAdapter } from '@rootlodge/reality/compat';

// Utilities
export { createHash } from '@rootlodge/reality';
```

## Key Exports from @rootlodge/reality-server

```typescript
// Server
export { createRealityServer, RealityServer } from '@rootlodge/reality-server';

// Embedded
export { createEmbeddedRealityServer } from '@rootlodge/reality-server';

// Storage
export { MemoryStorage, createSQLStorage, createDrizzleStorage } from '@rootlodge/reality-server';

// Invalidation
export { createDrizzleInvalidationAdapter, createPrismaInvalidationAdapter } from '@rootlodge/reality-server';

// HTTP
export { createExpressMiddleware, createFetchHandler } from '@rootlodge/reality-server';
```

## Remember

1. **Reality doesn't store your data** - it only tracks change metadata
2. **Database is optional** - in-memory works for most cases
3. **Call `invalidate()` when your data changes** - this is how Reality knows
4. **Clients fetch data from YOUR API** - Reality just tells them when to refetch
5. **Use `'auto'` execution mode** - it detects the right mode automatically
