# Reality Architecture

## Overview

Reality is a **socketless real-time infrastructure** that achieves real-time feel without persistent connections. It uses a model called **Deterministic Pull with Mesh-Aware Coordination**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REALITY ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   Client A  │     │   Client B  │     │   Client C  │                   │
│  │  (Browser)  │     │  (Mobile)   │     │  (Desktop)  │                   │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                   │
│         │                   │                   │                           │
│         │ POST              │ POST              │ POST                      │
│         │ /sync             │ /sync             │ /sync                     │
│         ▼                   ▼                   ▼                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Load Balancer                                  │  │
│  │                    (No sticky sessions!)                              │  │
│  └──────┬──────────────────────┬──────────────────────┬─────────────────┘  │
│         │                      │                      │                     │
│         ▼                      ▼                      ▼                     │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐             │
│  │  Server 1   │◄──────►│  Server 2   │◄──────►│  Server 3   │             │
│  │  (Stateless)│  Mesh  │  (Stateless)│  Mesh  │  (Stateless)│             │
│  └──────┬──────┘ Gossip └──────┬──────┘ Gossip └──────┬──────┘             │
│         │                      │                      │                     │
│         └──────────────────────┼──────────────────────┘                     │
│                                │                                            │
│                                ▼                                            │
│                    ┌─────────────────────┐                                  │
│                    │      Database       │                                  │
│                    │  (Source of Truth)  │                                  │
│                    └─────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Deterministic Pull

Unlike WebSockets (server pushes) or polling (client repeatedly asks), Reality uses **Deterministic Pull**:

1. Client knows what version it has for each key
2. Client asks server: "Here's what I have, what changed?"
3. Server responds with only the changed keys
4. Client fetches new payloads only for changed keys

```
Client                                   Server
  │                                         │
  │  POST /reality/sync                     │
  │  { known: { "chat:room:1": 5 } }        │
  │ ───────────────────────────────────────►│
  │                                         │
  │         Check versions...               │
  │         chat:room:1 is now v6           │
  │                                         │
  │  { changed: { "chat:room:1": { v: 6 } }}│
  │ ◄───────────────────────────────────────│
  │                                         │
  │  Version changed! Fetch payload...      │
  │                                         │
  │  GET /api/rooms/1/messages              │
  │ ───────────────────────────────────────►│
  │                                         │
  │  [{ id: 1, text: "hello" }, ...]        │
  │ ◄───────────────────────────────────────│
  │                                         │
```

### 2. Global Invalidation Graph

The server maintains a **Global Invalidation Graph** - metadata about what changed and when:

```typescript
interface RealityNodeMeta {
  key: string;       // Unique identifier
  version: number;   // Monotonically increasing
  hash: string;      // Content hash for change detection
  updatedAt: number; // Timestamp
}
```

The graph contains **metadata only** - no payloads. This keeps it lightweight:

```
┌─────────────────────────────────────────────────────────────────┐
│                   Global Invalidation Graph                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Key                    Version    Hash         Updated         │
│  ─────────────────────  ─────────  ──────────   ───────────    │
│  chat:room:general      42         "abc123"     1699876543     │
│  chat:room:random       18         "def456"     1699876500     │
│  user:profile:123       7          "ghi789"     1699875000     │
│  notifications:all      156        "jkl012"     1699876542     │
│                                                                 │
│  No message content! No notification text! Just metadata.       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Mesh-Aware Coordination

Servers are **stateless but mesh-aware**. They share peer information through gossip piggybacked on normal requests:

```
Server 1                     Server 2                     Server 3
   │                            │                            │
   │  Response includes:        │                            │
   │  { mesh: { peers: [2,3] }} │                            │
   │ ◄──────────────────────────│                            │
   │                            │                            │
   │                            │  Response includes:        │
   │                            │  { mesh: { peers: [1,3] }} │
   │                            │ ◄──────────────────────────│
   │                            │                            │
```

No additional connections needed. Mesh info flows through normal traffic.

## Protocol Specification

### Sync Request

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

### Sync Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "changed": {
    "chat:room:general": {
      "key": "chat:room:general",
      "version": 6,
      "hash": "abc123def",
      "updatedAt": 1699876543210
    }
  },
  "mesh": {
    "peers": ["server-2", "server-3"],
    "serverVersion": 1
  }
}
```

### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success - check `changed` for updates |
| 400 | Invalid request format |
| 500 | Server error |

## Client Behavior

### When to Sync

Reality syncs on specific events, not on a timer:

1. **Initial mount** - Component subscribes to a key
2. **Focus/visibility** - Tab becomes visible, window gains focus
3. **Network reconnect** - Device comes back online
4. **After mutation** - Verify optimistic update succeeded
5. **Manual trigger** - User clicks refresh

```typescript
// Browser events that trigger sync
window.addEventListener('focus', () => reality.syncAll());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    reality.syncAll();
  }
});

// React Native uses AppState instead
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    reality.syncAll();
  }
});
```

### Version Tracking

Client maintains local version cache:

```typescript
class SyncEngine {
  private versions = new Map<string, number>();
  
  async sync(keys: string[]): Promise<ChangedKeys> {
    // Build known versions map
    const known: Record<string, number> = {};
    for (const key of keys) {
      known[key] = this.versions.get(key) ?? 0;
    }
    
    // Send sync request
    const response = await this.transport.sync({ known });
    
    // Update local versions
    for (const [key, meta] of Object.entries(response.changed)) {
      this.versions.set(key, meta.version);
    }
    
    return response.changed;
  }
}
```

### Optimistic Updates

Mutations update UI immediately, then verify:

```
┌──────────────┐                              ┌──────────────┐
│    Client    │                              │    Server    │
├──────────────┤                              ├──────────────┤
│              │                              │              │
│ User sends   │                              │              │
│ "Hello!"     │                              │              │
│      │       │                              │              │
│      ▼       │                              │              │
│ ┌──────────┐ │                              │              │
│ │ Optimistic│ │                              │              │
│ │ Update UI │ │  POST /api/messages         │              │
│ │ (pending) │ │ ────────────────────────────► Save msg    │
│ └──────────┘ │                              │ Update node  │
│      │       │                              │      │       │
│      │       │  { id: 123, text: "Hello!" } │      │       │
│      │       │ ◄────────────────────────────│      │       │
│      │       │                              │              │
│      ▼       │  POST /reality/sync          │              │
│ ┌──────────┐ │ ────────────────────────────►│ Version +1   │
│ │Verify via│ │                              │              │
│ │sync check│ │  { changed: { room: v7 } }   │              │
│ └──────────┘ │ ◄────────────────────────────│              │
│      │       │                              │              │
│      ▼       │  GET /api/rooms/1/messages   │              │
│ ┌──────────┐ │ ────────────────────────────►│              │
│ │Reconcile │ │                              │              │
│ │with truth│ │  [ ...messages ]             │              │
│ └──────────┘ │ ◄────────────────────────────│              │
│              │                              │              │
└──────────────┘                              └──────────────┘
```

## Server Behavior

### Stateless Request Handling

Each request is independent:

```typescript
async handleSync(request: SyncRequest): Promise<SyncResponse> {
  const changed: Record<string, RealityNodeMeta> = {};
  
  // Compare each key client knows about
  for (const [key, clientVersion] of Object.entries(request.known)) {
    const serverNode = await this.storage.getNode(key);
    
    if (serverNode && serverNode.version > clientVersion) {
      changed[key] = serverNode;
    }
  }
  
  return {
    changed,
    mesh: this.getMeshInfo(),
  };
}
```

### Node Updates

When application data changes:

```typescript
// Your application code
async function addMessage(roomId: string, message: Message) {
  // 1. Save to database
  await db.messages.insert(message);
  
  // 2. Update Reality node
  const messages = await db.messages.findByRoom(roomId);
  const hash = createHash(messages.map(m => m.id).join(','));
  await realityServer.updateNode(`chat:room:${roomId}`, hash);
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

## Comparison with Alternatives

### vs WebSockets

```
WebSockets                         Reality
─────────────────────────────────  ─────────────────────────────────
✗ Persistent connection            ✓ No persistent connections
✗ Connection management            ✓ Stateless HTTP
✗ Sticky sessions for scale        ✓ Any load balancer
✗ Firewall/proxy issues            ✓ Works everywhere
✗ Custom protocol                  ✓ Standard HTTP

✓ Server can push instantly        ~ Client pulls on events
✓ Binary protocol efficiency       ✓ JSON + HTTP/2 compression
```

### vs SSE (Server-Sent Events)

```
SSE                                Reality
─────────────────────────────────  ─────────────────────────────────
✗ Long-lived connection            ✓ Short-lived requests
✗ Memory per connection            ✓ Constant memory
✗ Connection tracking              ✓ No connection state
✗ Reconnection complexity          ✓ Simple retry

✓ Server push                      ~ Event-driven pull
✓ Built-in reconnection            ✓ Focus/visibility triggers
```

### vs Polling

```
Polling                            Reality
─────────────────────────────────  ─────────────────────────────────
✗ Always fetches payload           ✓ Version check first
✗ Wastes bandwidth                 ✓ Skip if unchanged
✗ Latency vs load tradeoff         ✓ Event-driven sync
✗ No change detection              ✓ Hash-based detection

✓ Simple to implement              ✓ Simple to implement
✓ Works everywhere                 ✓ Works everywhere
```

## Scaling

### Horizontal Scaling

Add servers without coordination:

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │ (Round Robin)   │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Server 1 │   │ Server 2 │   │ Server 3 │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                           ▼
                    ┌─────────────┐
                    │  Database   │
                    └─────────────┘
```

### With Redis Acceleration

Optional Redis pub/sub for faster propagation:

```
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Server 1 │   │ Server 2 │   │ Server 3 │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                           ▼
                    ┌─────────────┐
                    │    Redis    │ ◄── Optional!
                    │   Pub/Sub   │     System works
                    └─────────────┘     without it.
```

**Critical:** Redis is for acceleration only. Correctness MUST NOT depend on Redis.

## Security Considerations

### Key Design

Use namespaced keys to enforce access control:

```typescript
// Good: User-scoped keys
`user:${userId}:profile`
`user:${userId}:settings`

// Good: Resource-scoped keys
`team:${teamId}:chat:${channelId}`

// Validate in middleware
function validateKeyAccess(userId: string, key: string) {
  if (key.startsWith(`user:${userId}:`)) return true;
  // Check team membership, etc.
}
```

### Rate Limiting

```typescript
const rateLimiter = new RateLimiter({
  windowMs: 1000,
  maxRequests: 10,
});

app.post('/reality/sync', rateLimiter.middleware, handler);
```

### Payload Validation

```typescript
import { SyncRequestSchema } from '@rootlodge/reality/types';

function handler(request: Request) {
  const body = await request.json();
  const parsed = SyncRequestSchema.parse(body); // Throws on invalid
  return server.handleSync(parsed);
}
```

## Best Practices

### 1. Key Naming Convention

```typescript
// Format: domain:resource:id[:subresource]
'chat:room:general'
'chat:room:general:typing'
'user:123:profile'
'team:456:members'
'notifications:user:123'
```

### 2. Hash Strategy

Choose based on your data:

```typescript
// For lists: hash IDs
const hash = createHash(items.map(i => i.id).join(','));

// For documents: hash content
const hash = createHash(JSON.stringify(document));

// For counters: use the value
const hash = String(counter);
```

### 3. Granularity

Balance between sync efficiency and complexity:

```typescript
// Too coarse: One key for all data
'app:data' // Bad - everything refetches on any change

// Too fine: Key per item
'message:1', 'message:2', 'message:3' // Bad - too many keys to track

// Just right: Key per collection/view
'chat:room:general' // Good - room messages sync together
```

### 4. Error Handling

```typescript
const { data, error, sync } = useReality('key', {
  fetcher: async (key) => {
    const res = await fetch(`/api/${key}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  },
  onError: (error) => {
    toast.error('Sync failed. Retrying...');
  },
});
```

## Migration Guide

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions from:
- WebSockets
- Server-Sent Events (SSE)
- Polling
