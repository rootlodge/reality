# Polling → Reality Migration Example

This example demonstrates migrating from traditional polling to Reality with **visibly reduced network usage**.

## The Problem with Polling

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Traditional Polling                                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Time    Client Request              Server Response                   │
│  ─────   ──────────────              ───────────────                   │
│  0:00    GET /notifications    →     [full payload ~2KB]               │
│  0:02    GET /notifications    →     [same data, wasted]               │
│  0:04    GET /notifications    →     [same data, wasted]               │
│  0:06    GET /notifications    →     [same data, wasted]               │
│  0:08    GET /notifications    →     [NEW! 1 notification added]       │
│  0:10    GET /notifications    →     [same data, wasted]               │
│  0:12    GET /notifications    →     [same data, wasted]               │
│                                                                        │
│  After 1 minute: 30 requests, 28 were wasted (93% waste)               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## The Reality Solution

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Reality Version-Based Sync                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Time    Action                      Bytes Transferred                 │
│  ─────   ──────                      ─────────────────                 │
│  0:00    Tab focused → sync check    ~50 bytes (version only)          │
│          Version changed → fetch     ~2KB (payload)                    │
│  0:05    Tab refocused → sync        ~50 bytes                         │
│          Same version → skip         0 bytes saved!                    │
│  0:10    User clicks refresh         ~50 bytes                         │
│          Same version → skip         0 bytes saved!                    │
│  0:15    Data changes on server      (nothing yet)                     │
│  0:20    Tab refocused → sync        ~50 bytes                         │
│          Version changed → fetch     ~2KB (payload)                    │
│                                                                        │
│  After 1 minute: 4 syncs + 2 fetches = ~4.2KB vs ~60KB polling         │
│  Bandwidth saved: ~93%                                                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Migration Options

### Option 1: Polling Adapter (Quick Migration)

Keep the polling pattern but add version-based skip:

```typescript
// BEFORE: Always fetches full payload
useEffect(() => {
  const interval = setInterval(async () => {
    const data = await fetch('/api/notifications').then(r => r.json());
    setNotifications(data);
  }, 2000);
  return () => clearInterval(interval);
}, []);

// AFTER: Only fetches when version changes
import { createPollingAdapter } from '@rootlodge/reality/compat';

useEffect(() => {
  const adapter = createPollingAdapter({
    key: 'notifications:all',
    realityEndpoint: '/reality/sync',
    payloadEndpoint: '/api/notifications',
    interval: 2000,
    onData: setNotifications,
  });
  adapter.start();
  return () => adapter.stop();
}, []);
```

### Option 2: Native Reality Hooks (Recommended)

No polling at all - event-driven sync:

```typescript
// BEFORE: Polling every 2 seconds
function usePollingNotifications() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/notifications');
      setData(await res.json());
    };
    
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);
  
  return data;
}

// AFTER: Reality - syncs on focus, not on timer
function useRealityNotifications() {
  const { data } = useReality('notifications:all', {
    fetcher: () => fetch('/api/notifications').then(r => r.json()),
    fallback: [],
  });
  
  return data;
}
```

## Running the Example

### Start the Reality Server (New)

```bash
bun run server
# → Listening on http://localhost:3000
```

### Start the Old Polling Server (For Comparison)

```bash
bun run server:old
# → Listening on http://localhost:3001
```

### Start the Client

```bash
pnpm run dev
# → http://localhost:5173
```

## Bandwidth Comparison

Open your browser's Network tab and watch:

| Mode | 10 Minutes | Bytes Transferred |
|------|------------|-------------------|
| Polling (2s) | 300 requests | ~600 KB |
| Polling Compat | 300 syncs, ~30 fetches | ~75 KB |
| Reality Native | ~20 syncs/fetches | ~10 KB |

## When Does Reality Sync?

Native mode syncs on these events (no polling!):

1. **Initial mount** - Component loads for the first time
2. **Tab focus** - User returns to the browser tab
3. **Visibility change** - Page becomes visible after being hidden
4. **After mutations** - After optimistic updates, verify server state
5. **Manual refresh** - User clicks refresh button
6. **Network reconnect** - After coming back online

## Key Takeaways

1. **Polling fetches blindly** - Reality checks versions first
2. **Polling wastes bandwidth** - Reality skips when unchanged
3. **Polling needs tuning** - Reality adapts to user behavior
4. **Polling runs forever** - Reality syncs on-demand

## Files in This Example

- `server-old-polling.ts` - Traditional polling server
- `server.ts` - Reality server with version tracking
- `src/old-polling-client.tsx` - Old polling-based client
- `src/new-reality-client.tsx` - Reality-based client (both options)
- `src/main.tsx` - Demo app comparing all approaches
