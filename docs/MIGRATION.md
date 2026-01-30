# Migration Guide

This guide covers migrating from WebSockets, SSE, and polling to Reality.

## Table of Contents

1. [Migration Strategies](#migration-strategies)
2. [From SSE](#from-sse)
3. [From Polling](#from-polling)
4. [From WebSockets](#from-websockets)
5. [Gradual Rollout](#gradual-rollout)

## Migration Strategies

Reality offers three approaches:

| Strategy | Code Changes | Risk | Best For |
|----------|--------------|------|----------|
| **Drop-in Replacement** | Minimal | Low | Quick wins, testing |
| **Gradual Migration** | Moderate | Low | Production systems |
| **Full Rewrite** | Significant | Medium | New features |

## From SSE

### Before: Traditional SSE

```typescript
// Client
const eventSource = new EventSource('/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateUI(data);
};
eventSource.onerror = () => {
  // Manual reconnection
  setTimeout(() => reconnect(), 1000);
};

// Server
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Track connection
  clients.add(res);
  
  // Send initial data
  res.write(`data: ${JSON.stringify(getData())}\n\n`);
  
  req.on('close', () => {
    clients.delete(res);
  });
});

// Broadcast on changes
function broadcast(data) {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}
```

### Option 1: Drop-in Replacement (5 minutes)

Replace `EventSource` with `RealityEventSource`:

```typescript
// Client - just change the import!
import { RealityEventSource } from '@rootlodge/reality/compat';

const eventSource = new RealityEventSource('/events', {
  realityEndpoint: '/reality/sync',
});
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateUI(data);
};
// No more onerror handling needed - Reality handles it

// Server - add Reality endpoint
import { RealityServer, MemoryStorage, createFetchHandler } from '@rootlodge/reality-server';

const server = new RealityServer({ storage: new MemoryStorage() });

// Add Reality sync endpoint
app.post('/reality/sync', createFetchHandler(server));

// Keep existing SSE endpoint for compatibility
// But update node on changes
function updateData(newData) {
  data = newData;
  broadcast(data); // Keep for old clients
  server.updateNode('events:all', createHash(data)); // For Reality clients
}
```

### Option 2: Native Integration (Recommended)

```typescript
// Client
import { RealityProvider, useReality } from '@rootlodge/reality/react';

function App() {
  return (
    <RealityProvider endpoint="/reality/sync">
      <Dashboard />
    </RealityProvider>
  );
}

function Dashboard() {
  const { data, isLoading, sync } = useReality('dashboard:data', {
    fallback: null,
    fetcher: () => fetch('/api/dashboard').then(r => r.json()),
  });

  if (isLoading) return <Loading />;
  return <DashboardView data={data} onRefresh={sync} />;
}

// Server
import { RealityServer, createFetchHandler } from '@rootlodge/reality-server';

const server = new RealityServer({ storage });
app.post('/reality/sync', createFetchHandler(server));

// REST endpoint for data
app.get('/api/dashboard', (req, res) => {
  res.json(getDashboardData());
});

// Update node when data changes
function updateDashboard(data) {
  saveDashboardData(data);
  server.updateNode('dashboard:data', createHash(data));
}
```

## From Polling

### Before: Traditional Polling

```typescript
// Client
function startPolling() {
  setInterval(async () => {
    const data = await fetch('/api/data').then(r => r.json());
    updateUI(data);
  }, 2000);
}

// Server
app.get('/api/data', (req, res) => {
  res.json(getData());
});
```

### Option 1: Polling Adapter (5 minutes)

Add version-based skipping:

```typescript
// Client
import { createPollingAdapter } from '@rootlodge/reality/compat';

const adapter = createPollingAdapter({
  key: 'data:all',
  realityEndpoint: '/reality/sync',
  payloadEndpoint: '/api/data',
  interval: 2000,
  onData: updateUI,
});

adapter.start();

// Server - add Reality
import { RealityServer, createFetchHandler } from '@rootlodge/reality-server';

const server = new RealityServer({ storage });
app.post('/reality/sync', createFetchHandler(server));

// Keep existing endpoint
app.get('/api/data', (req, res) => {
  res.json(getData());
});

// Update node when data changes
server.updateNode('data:all', createHash(getData()));
```

**Result:** Same polling interval, but skips fetch when data unchanged. ~80% bandwidth reduction!

### Option 2: Native Integration

```typescript
// Client - no polling at all!
function DataView() {
  const { data, sync } = useReality('data:all', {
    fallback: null,
    fetcher: () => fetch('/api/data').then(r => r.json()),
  });

  return (
    <div>
      {data && <DataDisplay data={data} />}
      <button onClick={sync}>Refresh</button>
    </div>
  );
}

// Syncs automatically on:
// - Initial mount
// - Tab focus
// - Network reconnect
// - Manual refresh
```

**Result:** No polling loop! Syncs only when user is active.

## From WebSockets

### Before: WebSocket Implementation

```typescript
// Client
const ws = new WebSocket('wss://example.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'chat' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'message') {
    addMessage(msg.data);
  }
};

ws.onclose = () => {
  setTimeout(() => reconnect(), 1000);
};

function sendMessage(text) {
  ws.send(JSON.stringify({ type: 'message', text }));
}

// Server
const wss = new WebSocketServer({ port: 8080 });
const channels = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'subscribe') {
      addToChannel(msg.channel, ws);
    } else if (msg.type === 'message') {
      broadcastToChannel(msg.channel, msg);
    }
  });
});
```

### After: Reality Implementation

```typescript
// Client
function Chat({ roomId }) {
  const { data: messages, sync } = useReality(`chat:room:${roomId}`, {
    fallback: [],
    fetcher: async (key) => {
      const id = key.split(':').pop();
      return fetch(`/api/rooms/${id}/messages`).then(r => r.json());
    },
  });

  const { mutate } = useMutation(`chat:room:${roomId}`, async (text) => {
    return fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ roomId, text }),
    }).then(r => r.json());
  }, {
    optimisticUpdate: (msgs, text) => [...msgs, { id: 'temp', text, pending: true }],
    rollbackOnError: true,
  });

  return (
    <div>
      {messages.map(m => <Message key={m.id} {...m} />)}
      <input onSubmit={(text) => mutate(text)} />
    </div>
  );
}

// Server
app.post('/reality/sync', createFetchHandler(server));

app.get('/api/rooms/:id/messages', async (req, res) => {
  const messages = await db.messages.findByRoom(req.params.id);
  res.json(messages);
});

app.post('/api/messages', async (req, res) => {
  const message = await db.messages.create(req.body);
  await server.updateNode(`chat:room:${req.body.roomId}`, createHash(...));
  res.json(message);
});
```

### Key Differences

| WebSocket | Reality |
|-----------|---------|
| Bidirectional persistent connection | Unidirectional HTTP requests |
| Server pushes messages | Client pulls on events |
| Connection state management | Stateless |
| Custom reconnection logic | Built-in handling |
| Binary/text framing | JSON over HTTP |

### What You Lose

1. **Instant server push** - Reality syncs on events (focus, mutation, etc.)
2. **Sub-second latency** - Typical latency is 100-500ms
3. **Bidirectional streaming** - Each message is a new request

### What You Gain

1. **No connection management** - Just HTTP
2. **Works everywhere** - Behind any proxy/firewall
3. **Easy scaling** - No sticky sessions
4. **Built-in features** - Optimistic updates, deduplication, caching

## Gradual Rollout

### Phase 1: Add Reality Endpoint

```typescript
// Add Reality without changing anything else
const server = new RealityServer({ storage });
app.post('/reality/sync', createFetchHandler(server));

// Update nodes when data changes (in addition to existing logic)
function onDataChange(key, data) {
  // Existing broadcast/push logic stays
  existingBroadcast(data);
  
  // Add Reality node update
  server.updateNode(key, createHash(data));
}
```

### Phase 2: A/B Test New Clients

```typescript
// Feature flag for Reality mode
const useReality = featureFlags.get('use_reality');

function DataProvider({ children }) {
  if (useReality) {
    return (
      <RealityProvider endpoint="/reality/sync">
        {children}
      </RealityProvider>
    );
  }
  return <LegacyProvider>{children}</LegacyProvider>;
}
```

### Phase 3: Migrate Component by Component

```typescript
// Migrate one component at a time
function Notifications() {
  if (featureFlags.get('notifications_reality')) {
    return <NotificationsReality />;
  }
  return <NotificationsSSE />;
}
```

### Phase 4: Remove Legacy Code

```typescript
// Once all clients migrated, remove:
// - EventSource endpoints
// - WebSocket server
// - Polling endpoints
// - Connection tracking code
// - Broadcast logic

// Keep only:
// - Reality sync endpoint
// - REST endpoints for data
// - Node update calls
```

## Checklist

### Server Migration

- [ ] Install `@rootlodge/reality-server`
- [ ] Create storage adapter
- [ ] Add `/reality/sync` endpoint
- [ ] Call `updateNode()` when data changes
- [ ] Test with Reality client
- [ ] Remove old connection tracking
- [ ] Remove broadcast logic

### Client Migration

- [ ] Install `@rootlodge/reality`
- [ ] Add `RealityProvider` to app root
- [ ] Replace SSE/WS hooks with `useReality`
- [ ] Replace send functions with `useMutation`
- [ ] Test optimistic updates
- [ ] Test sync on focus/reconnect
- [ ] Remove old connection code

## FAQ

### Q: Will my UI feel slower?

Not noticeably. Reality syncs on focus (instant for active users) and after mutations (verifies immediately). The "real-time" feel comes from optimistic updates.

### Q: What about typing indicators?

For truly ephemeral, sub-second data like typing indicators, you have options:
1. Keep a small WebSocket just for ephemeral signals
2. Use short polling with Reality version checking
3. Accept slight delay (500ms-1s) - often acceptable

### Q: Can I use Reality for gaming/financial?

If you need <50ms latency, Reality isn't the right choice. Use WebSockets or dedicated game networking. Reality is for typical web app use cases where 100-500ms is acceptable.

### Q: How do I handle offline?

Reality works great with offline:
```typescript
const { data, isStale, sync } = useReality('key', {
  // Data persists in memory/storage
  // isStale indicates it may be outdated
});

// When back online, sync automatically triggers
```
