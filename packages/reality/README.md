# @rootlodge/reality

**Socketless Real-Time Infrastructure for TypeScript**

> Replaces WebSockets, SSE, and polling with something better.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   "Real-time" without long-lived connections.                          │
│   Scale by adding servers, not complexity.                             │
│   Works everywhere HTTP works.                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Client package
npm install @rootlodge/reality

# Server package  
npm install @rootlodge/reality-server
```

### Client (React)

```tsx
import { RealityProvider, useReality, useMutation } from '@rootlodge/reality/react';

function App() {
  return (
    <RealityProvider endpoint="/reality/sync">
      <Chat />
    </RealityProvider>
  );
}

function Chat() {
  // Subscribe to real-time data
  const { data: messages, isLoading, sync } = useReality<Message[]>(
    'chat:room:general',
    {
      fallback: [],
      fetcher: () => fetch('/api/messages').then(r => r.json()),
    }
  );

  // Mutate with optimistic updates
  const { mutate } = useMutation<Message, string>(
    'chat:room:general',
    (text) => fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }).then(r => r.json()),
    {
      optimisticUpdate: (msgs, text) => [...msgs, { id: 'temp', text, pending: true }],
      rollbackOnError: true,
    }
  );

  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.text}</div>)}
      <button onClick={() => mutate('Hello!')}>Send</button>
    </div>
  );
}
```

### Server (Node.js/Bun)

```typescript
import { RealityServer, MemoryStorage, createFetchHandler } from '@rootlodge/reality-server';

const server = new RealityServer({
  storage: new MemoryStorage(),
  serverId: 'server-1',
});

const handler = createFetchHandler(server);

// With any HTTP framework
app.post('/reality/sync', handler);

// When data changes, update the node
await server.updateNode('chat:room:general', hashOfMessages);
```

## Why Reality?

### The Problem

| Technology | Issues |
|------------|--------|
| **WebSockets** | Connection management, sticky sessions, load balancer config, firewall issues |
| **SSE** | Long-lived connections, memory per client, scaling challenges |
| **Polling** | Wasteful, latency tradeoff, no way to know if data changed |

### The Solution

Reality uses **Deterministic Pull** - clients reconcile state via short-lived HTTP:

```
┌──────────┐                           ┌──────────┐
│  Client  │  POST /reality/sync       │  Server  │
│          │  { known: { key: v5 } }   │          │
│          │ ────────────────────────► │          │
│          │                           │          │
│          │  { changed: { key: v6 } } │          │
│          │ ◄──────────────────────── │          │
│          │                           │          │
│          │  GET /api/data            │          │
│          │ ────────────────────────► │          │
│          │                           │          │
└──────────┘                           └──────────┘

No persistent connections. No sticky sessions. Just HTTP.
```

## Features

### ✅ No Long-Lived Connections
Every request completes immediately. No WebSocket lifecycle to manage.

### ✅ Scales Horizontally
Add servers without coordination. No sticky sessions required.

### ✅ Works Everywhere
Behind CDNs, load balancers, proxies, firewalls - if HTTP works, Reality works.

### ✅ Type-Safe
Full TypeScript support with Zod runtime validation.

### ✅ Framework Agnostic
Works with React, React Native, Node.js, Bun, Deno, Edge functions.

### ✅ Migration Path
Drop-in `EventSource` and polling replacements for gradual migration.

## API Reference

### Client

#### `RealityProvider`

Wraps your app to provide Reality context:

```tsx
<RealityProvider
  endpoint="/reality/sync"
  mode="native"           // "native" | "sse-compat" | "polling-compat"
  syncOnFocus={true}      // Sync when tab gains focus
  syncOnReconnect={true}  // Sync when network reconnects
>
  {children}
</RealityProvider>
```

#### `useReality<T>(key, options)`

Subscribe to real-time data:

```typescript
const { 
  data,       // The current data (T | undefined)
  error,      // Any error that occurred
  isLoading,  // Initial load in progress
  isSyncing,  // Background sync in progress
  isStale,    // Data may be outdated
  meta,       // Version info, timestamps
  sync,       // Manually trigger sync
  invalidate, // Force refetch
} = useReality<Message[]>('chat:room:general', {
  fallback: [],                    // Default value
  fetcher: (key) => fetchData(key), // How to get the payload
  staleTime: 5000,                 // Ms before considered stale
  dedupeInterval: 1000,            // Dedupe rapid requests
});
```

#### `useMutation<T, Input>(key, mutationFn, options)`

Mutate data with optimistic updates:

```typescript
const { 
  mutate,    // Function to call with input
  isLoading, // Mutation in progress
  error,     // Any error
  reset,     // Clear error state
} = useMutation<Message, string>(
  'chat:room:general',
  async (text) => {
    const res = await fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return res.json();
  },
  {
    optimisticUpdate: (current, text) => [...current, { id: 'temp', text }],
    rollbackOnError: true,
    onSuccess: (result) => console.log('Sent:', result),
    onError: (error) => console.error('Failed:', error),
  }
);
```

#### `useSync()`

Access sync controls directly:

```typescript
const { syncAll, syncKeys, isAnySyncing, getVersion } = useSync();

// Sync everything
await syncAll();

// Sync specific keys
await syncKeys(['chat:room:general', 'user:profile']);
```

### Compatibility Layer

#### `RealityEventSource` (Drop-in EventSource replacement)

```typescript
import { RealityEventSource } from '@rootlodge/reality/compat';

// Replace: const es = new EventSource('/events');
const es = new RealityEventSource('/events', {
  realityEndpoint: '/reality/sync',
});

es.onmessage = (event) => {
  console.log(event.data);
};
```

#### `createPollingAdapter` (Version-aware polling)

```typescript
import { createPollingAdapter } from '@rootlodge/reality/compat';

const adapter = createPollingAdapter({
  key: 'notifications:all',
  realityEndpoint: '/reality/sync',
  payloadEndpoint: '/api/notifications',
  interval: 2000,
  onData: (data) => setNotifications(data),
});

adapter.start();
```

## Modes

Reality supports three modes for different migration stages:

| Mode | Description | Use Case |
|------|-------------|----------|
| `native` | Version-based pull sync | New projects, full migration |
| `sse-compat` | EventSource API compatibility | Migrating from SSE |
| `polling-compat` | Polling with version skip | Migrating from polling |

## Examples

See the `/examples` directory:

- **react-chat** - Full chat app with optimistic updates
- **sse-migration** - Side-by-side SSE comparison
- **polling-migration** - Bandwidth reduction demo
- **react-native** - Mobile app integration

## Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed explanation.

## License

MIT
