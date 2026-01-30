# Reality

> **Socketless Real-Time Infrastructure**

Reality replaces WebSockets, SSE, and polling with something better: **Deterministic Pull**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ╔═══════════════════════════════════════════════════════════════════╗    │
│    ║                                                                   ║    │
│    ║   Real-time without long-lived connections.                       ║    │
│    ║   Scale by adding servers, not complexity.                        ║    │
│    ║   Works everywhere HTTP works.                                    ║    │
│    ║                                                                   ║    │
│    ╚═══════════════════════════════════════════════════════════════════╝    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| [`@rootlodge/reality`](./packages/reality) | Client library (React, React Native, vanilla) |
| [`@rootlodge/reality-server`](./packages/reality-server) | Server library (Node.js, Bun, Deno, Edge) |

## Installation

```bash
# Client
npm install @rootlodge/reality

# Server
npm install @rootlodge/reality-server
```

## Quick Start

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
  const { data: messages } = useReality('chat:room:general', {
    fallback: [],
    fetcher: () => fetch('/api/messages').then(r => r.json()),
  });

  const { mutate } = useMutation('chat:room:general', (text) =>
    fetch('/api/messages', { method: 'POST', body: JSON.stringify({ text }) })
  );

  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.text}</div>)}
      <button onClick={() => mutate('Hello!')}>Send</button>
    </div>
  );
}
```

### Server (Bun/Node.js)

```typescript
import { RealityServer, MemoryStorage, createFetchHandler } from '@rootlodge/reality-server';

const server = new RealityServer({
  storage: new MemoryStorage(),
});

// Add sync endpoint
app.post('/reality/sync', createFetchHandler(server));

// Update node when data changes
app.post('/api/messages', async (req, res) => {
  const message = await saveMessage(req.body);
  await server.updateNode('chat:room:general', hashOfMessages());
  res.json(message);
});
```

## Why Reality?

### The Problem

| Technology | Issue |
|------------|-------|
| **WebSockets** | Connection management, sticky sessions, firewall issues |
| **SSE** | Long-lived connections, memory per client, scaling challenges |
| **Polling** | Wasteful bandwidth, latency tradeoff, no change detection |

### The Solution

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│   Client: "I have version 5 of chat:room:general"                        │
│                                                                           │
│   Server: "It's now version 6" (or "Still 5, nothing changed")           │
│                                                                           │
│   Client: *fetches new data only if version changed*                      │
│                                                                           │
│   ──────────────────────────────────────────────────────────────────────  │
│                                                                           │
│   ✓ No persistent connections                                             │
│   ✓ No sticky sessions                                                    │
│   ✓ Works behind any CDN/load balancer                                    │
│   ✓ Scales horizontally                                                   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
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
Works with React, React Native, Node.js, Bun, Deno, Cloudflare Workers.

### ✅ Migration Path
Drop-in `EventSource` and polling replacements for gradual migration.

## Examples

| Example | Description |
|---------|-------------|
| [react-chat](./examples/react-chat) | Real-time chat with optimistic updates |
| [sse-migration](./examples/sse-migration) | Side-by-side SSE comparison |
| [polling-migration](./examples/polling-migration) | Bandwidth reduction demo |
| [react-native](./examples/react-native) | Mobile app integration |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | How Reality works under the hood |
| [Migration Guide](./docs/MIGRATION.md) | Migrate from WebSockets/SSE/Polling |
| [Compatibility](./docs/COMPATIBILITY.md) | Drop-in replacements for gradual migration |
| [Simple Explanation](./docs/SIMPLE_EXPLANATION.md) | Non-technical overview |

## Storage Adapters

| Adapter | Use Case |
|---------|----------|
| `MemoryStorage` | Development, testing |
| `SQLStorage` | PostgreSQL, MySQL, SQLite |
| `createDrizzleAdapter` | Drizzle ORM |
| `createPrismaAdapter` | Prisma ORM |
| `DynamoDBStorage` | AWS DynamoDB |

## Modes

| Mode | Description |
|------|-------------|
| `native` | Event-driven sync (recommended) |
| `sse-compat` | EventSource API compatibility |
| `polling-compat` | Polling with version-based skip |

## Protocol

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
  }
}
```

## Repository Structure

```
reality/
├── packages/
│   ├── reality/           # Client package
│   │   ├── src/
│   │   │   ├── types/     # Shared types and schemas
│   │   │   ├── client/    # Core client implementation
│   │   │   ├── react/     # React hooks and context
│   │   │   ├── compat/    # SSE/polling compatibility
│   │   │   └── utils/     # Utility functions
│   │   └── README.md
│   │
│   └── reality-server/    # Server package
│       ├── src/
│       │   ├── storage/   # Storage adapters
│       │   ├── mesh/      # Mesh coordination
│       │   ├── handlers/  # HTTP handlers
│       │   └── server.ts  # Main server class
│       └── README.md
│
├── examples/
│   ├── react-chat/        # React chat example
│   ├── sse-migration/     # SSE migration example
│   ├── polling-migration/ # Polling migration example
│   └── react-native/      # React Native example
│
├── docs/
│   ├── ARCHITECTURE.md    # Technical architecture
│   ├── MIGRATION.md       # Migration guide
│   ├── COMPATIBILITY.md   # Compatibility layers
│   └── SIMPLE_EXPLANATION.md
│
└── README.md              # This file
```

## Hard Constraints

Reality intentionally does NOT use:

- ❌ WebSockets
- ❌ Server-Sent Events (long-lived)
- ❌ WebRTC
- ❌ Long-polling
- ❌ Background polling loops
- ❌ Sticky sessions
- ❌ Leader election

## License

MIT

---

<p align="center">
  <strong>Reality: Real-time without the real-time headaches.</strong>
</p>

