# Compatibility Guide

Reality provides compatibility layers for gradual migration from existing real-time solutions.

## SSE Compatibility

### RealityEventSource

Drop-in replacement for `EventSource`:

```typescript
import { RealityEventSource } from '@rootlodge/reality/compat';

// Replace this:
// const es = new EventSource('/events');

// With this:
const es = new RealityEventSource('/events', {
  realityEndpoint: '/reality/sync',
  syncInterval: 1000,    // Check for updates every second
  fetchOnConnect: true,  // Get initial data immediately
});

// Same API as EventSource!
es.onopen = () => console.log('Connected');
es.onmessage = (event) => console.log(event.data);
es.onerror = (error) => console.error(error);
es.close();
```

### How It Works

```
EventSource (Old)                RealityEventSource (New)
─────────────────────────────    ────────────────────────────────────
1. Opens long-lived connection   1. Makes initial fetch
2. Server pushes data            2. Periodically checks version
3. Connection stays open         3. Fetches only if changed
4. Reconnects on failure         4. No persistent connection
```

### Server-Side SSE Compat

For servers that need to support both old and new clients:

```typescript
import { RealityServer, createFetchHandler } from '@rootlodge/reality-server';

const server = new RealityServer({ storage });

// New Reality endpoint
app.post('/reality/sync', createFetchHandler(server));

// SSE compatibility endpoint
app.get('/events', async (req, res) => {
  const response = await server.handleSSECompat(req, {
    keys: ['events:all'],
    heartbeatInterval: 30000,
  });
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  
  // Pipe the response
  response.body.pipeTo(res);
});
```

## Polling Compatibility

### createPollingAdapter

Add version-based skipping to existing polling:

```typescript
import { createPollingAdapter } from '@rootlodge/reality/compat';

// Replace this:
// setInterval(async () => {
//   const data = await fetch('/api/data').then(r => r.json());
//   updateUI(data);
// }, 2000);

// With this:
const adapter = createPollingAdapter({
  key: 'data:all',
  realityEndpoint: '/reality/sync',
  payloadEndpoint: '/api/data',
  interval: 2000,
  
  onSync: () => {
    console.log('Checked for updates');
  },
  
  onData: (data) => {
    console.log('Data changed:', data);
    updateUI(data);
  },
  
  onError: (error) => {
    console.error('Error:', error);
  },
});

// Control the adapter
adapter.start();  // Start polling
adapter.stop();   // Stop polling
adapter.sync();   // Force sync now
```

### How It Works

```
Traditional Polling              Reality Polling Adapter
────────────────────────────     ────────────────────────────────────
1. Fetch full payload            1. Check version (~50 bytes)
2. Compare locally               2. Server compares version
3. Update UI                     3. Skip if same version
4. Wait interval                 4. Fetch only if changed
5. Repeat                        5. Repeat

Bandwidth: 100%                  Bandwidth: ~20% (80% savings!)
```

### Server-Side Polling Compat

For servers that want to support version-aware polling:

```typescript
// Polling compat endpoint
app.get('/api/data/poll', async (req, res) => {
  const clientVersion = req.query.v;
  const currentNode = await server.storage.getNode('data:all');
  
  if (clientVersion && currentNode && 
      String(currentNode.version) === clientVersion) {
    // No changes - minimal response
    return res.json({ changed: false });
  }
  
  // Data changed - include payload and new version
  res.json({
    changed: true,
    version: currentNode?.version ?? 1,
    data: getData(),
  });
});
```

## Mode Selection

Reality supports three modes via the `mode` option:

```typescript
<RealityProvider
  endpoint="/reality/sync"
  mode="native"  // "native" | "sse-compat" | "polling-compat"
>
```

### Mode Comparison

| Mode | Best For | Network Pattern |
|------|----------|-----------------|
| `native` | New projects, full migration | Event-driven sync |
| `sse-compat` | Migrating from SSE | Simulated streaming |
| `polling-compat` | Migrating from polling | Interval with version skip |

### Native Mode (Default)

Event-driven sync without intervals:

```typescript
// Syncs on:
// - Component mount
// - Window focus
// - Visibility change
// - Network reconnect
// - After mutations
// - Manual trigger
```

### SSE-Compat Mode

Simulates EventSource behavior:

```typescript
<RealityProvider mode="sse-compat">
  {/* Children receive data as if from EventSource */}
</RealityProvider>
```

### Polling-Compat Mode

Interval-based with version checking:

```typescript
<RealityProvider
  mode="polling-compat"
  pollingInterval={2000}
>
  {/* Checks every 2 seconds, fetches only on change */}
</RealityProvider>
```

## API Equivalence

### EventSource → RealityEventSource

| EventSource | RealityEventSource |
|-------------|-------------------|
| `new EventSource(url)` | `new RealityEventSource(url, options)` |
| `es.onopen` | `es.onopen` |
| `es.onmessage` | `es.onmessage` |
| `es.onerror` | `es.onerror` |
| `es.close()` | `es.close()` |
| `es.readyState` | `es.readyState` |
| `es.url` | `es.url` |

### setInterval → createPollingAdapter

| Polling | Adapter |
|---------|---------|
| `setInterval(fn, ms)` | `adapter.start()` |
| `clearInterval(id)` | `adapter.stop()` |
| Manual fetch | `onData` callback |
| No change detection | Version-based skip |

## Mixed Deployment

During migration, you can run old and new systems simultaneously:

```typescript
// Server supports both
app.get('/events', sseHandler);           // Old SSE clients
app.post('/reality/sync', realityHandler); // New Reality clients
app.get('/api/data', dataHandler);        // REST for both

// Update logic notifies both
function onDataChange(key, data) {
  // SSE broadcast (old clients)
  sseClients.forEach(c => c.send(data));
  
  // Reality node update (new clients)
  realityServer.updateNode(key, createHash(data));
}
```

## Feature Detection

Check if Reality is available:

```typescript
// Client-side
async function checkRealitySupport() {
  try {
    const res = await fetch('/reality/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ known: {} }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Use appropriate client
const supportsReality = await checkRealitySupport();
if (supportsReality) {
  useRealityClient();
} else {
  useLegacySSE();
}
```

## Troubleshooting

### SSE Clients Not Receiving Updates

1. Ensure server calls `updateNode()` when data changes
2. Check that SSE compat endpoint is using correct keys
3. Verify heartbeat interval is set appropriately

### Polling Adapter Fetching Every Time

1. Check that server is returning correct version
2. Ensure `realityEndpoint` is correct
3. Verify storage adapter is persisting versions

### Mode Not Working as Expected

1. Ensure `RealityProvider` is at app root
2. Check that mode is spelled correctly
3. Verify endpoint URL is accessible
