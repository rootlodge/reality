# SSE → Reality Migration Example

This example demonstrates migrating from Server-Sent Events (SSE) to Reality with **identical UI behavior**.

## The Problem with SSE

```
┌──────────────────────────────────────────────────────────────────┐
│                    Traditional SSE Architecture                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client A ─────────────────────────────────────────► Server      │
│            (long-lived connection #1)                   │        │
│                                                         │        │
│  Client B ─────────────────────────────────────────►    │        │
│            (long-lived connection #2)                   │        │
│                                                         │        │
│  Client C ─────────────────────────────────────────►    │        │
│            (long-lived connection #3)                   │        │
│                                                         ▼        │
│                                              ┌─────────────────┐ │
│  At 10,000 clients:                          │  Memory: HIGH   │ │
│  - 10,000 open connections                   │  CPU: HIGH      │ │
│  - Memory for each connection state          │  Scale: HARD    │ │
│  - Load balancer sticky sessions required    └─────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## The Reality Solution

```
┌──────────────────────────────────────────────────────────────────┐
│                      Reality Architecture                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client A ──POST──► Server ──Response──► Client A                │
│            (short HTTP)     (instant)                            │
│                                                                  │
│  Client B ──POST──► Server ──Response──► Client B                │
│            (short HTTP)     (instant)                            │
│                                                                  │
│  Client C ──POST──► Server ──Response──► Client C                │
│            (short HTTP)     (instant)                            │
│                                                         ▼        │
│                                              ┌─────────────────┐ │
│  At 10,000 clients:                          │  Memory: LOW    │ │
│  - 0 persistent connections                  │  CPU: LOW       │ │
│  - No connection state to track              │  Scale: EASY    │ │
│  - Any load balancer works                   └─────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Migration Options

### Option 1: Drop-in Replacement (Quick Migration)

Minimal code changes - just swap `EventSource` for `RealityEventSource`:

```typescript
// BEFORE: Traditional SSE
const es = new EventSource('/events');
es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateUI(data);
};

// AFTER: Reality (drop-in replacement)
import { RealityEventSource } from '@rootlodge/reality/compat';

const es = new RealityEventSource('/events', {
  realityEndpoint: '/reality/sync',
});
es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateUI(data);
};
```

### Option 2: Native Reality Hooks (Recommended)

Full React integration with better DX:

```typescript
// BEFORE: SSE + React state management
function StockTicker() {
  const [stocks, setStocks] = useState([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/events');
    es.onmessage = (e) => setStocks(JSON.parse(e.data).stocks);
    eventSourceRef.current = es;
    return () => es.close();
  }, []);

  // ... reconnection logic, error handling, etc.
}

// AFTER: Reality hook
function StockTicker() {
  const { data: stocks, sync } = useReality<Stock[]>('stocks:all', {
    fallback: [],
    fetcher: () => fetch('/api/stocks').then(r => r.json()),
  });

  // That's it! Focus handling, reconnection, etc. are built-in.
}
```

## Running the Example

### Start the Reality Server (New)

```bash
bun run server
# → Listening on http://localhost:3000
```

### Start the Old SSE Server (For Comparison)

```bash
bun run server:old
# → Listening on http://localhost:3001
```

### Start the Client

```bash
pnpm run dev
# → http://localhost:5173
```

## Network Traffic Comparison

Open your browser's Network tab to see the difference:

| Metric | SSE | Reality |
|--------|-----|---------|
| Connection type | Long-lived | Short-lived |
| Connections per client | 1 persistent | 0 persistent |
| Update delivery | Server push | Client pull |
| Typical requests/sec | N/A (streaming) | 1-2 |
| Works behind CDN | ❌ | ✅ |
| Sticky sessions | Required | Not needed |

## What's Happening Under the Hood

### SSE Server (Old)

```typescript
// Track all connections in memory 😱
const connections = new Set<ReadableStreamController>();

// Broadcast to all - O(n) operation
function broadcast(data) {
  for (const controller of connections) {
    controller.enqueue(encode(data));
  }
}
```

### Reality Server (New)

```typescript
// No connection tracking needed! 🎉
// Just update the node version when data changes
await server.updateNode('stocks:all', hash);

// Clients will detect the change on next sync
```

## Key Takeaways

1. **SSE requires long-lived connections** - Reality uses short-lived HTTP
2. **SSE memory grows with clients** - Reality memory stays constant
3. **SSE needs sticky sessions** - Reality works with any load balancer
4. **SSE pushes every update** - Reality lets clients pull when ready

## Files in This Example

- `server-old-sse.ts` - Traditional SSE server (problematic)
- `server.ts` - Reality server (scalable)
- `src/old-sse-client.tsx` - Old EventSource-based client
- `src/new-reality-client.tsx` - Reality-based client
- `src/main.tsx` - Demo app comparing all approaches
