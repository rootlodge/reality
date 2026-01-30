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
│    ║   ⚠️  REALITY DOES NOT OWN YOUR DATA                              ║    │
│    ║   Your database. Your queries. Your control.                      ║    │
│    ║   Reality only tracks change metadata (version hashes).           ║    │
│    ║                                                                   ║    │
│    ╚═══════════════════════════════════════════════════════════════════╝    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## ⚠️ Important: Data Ownership

**Reality does NOT:**
- Store your application data
- Own your database
- Execute your queries
- See your actual payloads

**Reality only:**
- Tracks version hashes (metadata)
- Coordinates "this changed" notifications
- Helps clients know when to refetch

**You own:**
- Your database (Postgres, MySQL, SQLite, MongoDB, etc.)
- Your queries (Drizzle, Prisma, raw SQL, etc.)
- Your data fetching logic
- When and how to refetch

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

### ✅ SSR / TanStack / Vite Support
Embedded mode for SSR frameworks - no external server needed.

### ✅ Database Optional
Reality only tracks metadata. Your database is optional and entirely yours.

### ✅ Type-Safe
Full TypeScript support with Zod runtime validation.

### ✅ Framework Agnostic
Works with React, React Native, TanStack, Next.js, Nuxt, Bun, Deno, Cloudflare Workers.

### ✅ Migration Path
Drop-in `EventSource` and polling replacements for gradual migration.

## Execution Modes

| Mode | Use Case |
|------|----------|
| `client` | Browser apps connecting to external Reality server |
| `ssr-embedded` | SSR frameworks (TanStack, Next.js) - no external server |
| `server-external` | Server-side connecting to external Reality server |
| `auto` | Automatically detect environment (recommended) |

## Persistence Modes

| Mode | Description |
|------|-------------|
| `none` | No persistence - metadata in memory only |
| `advisory` | Reality suggests caching; you decide |
| `external` | Your app manages all persistence |

## Examples

| Example | Description |
|---------|-------------|
| [SSR TanStack](./packages/reality/examples/ssr-tanstack.ts) | TanStack Start SSR integration |
| [SSR Embedded](./packages/reality/examples/ssr-embedded.ts) | Embedded mode for any SSR framework |
| [Client Usage](./packages/reality/examples/client-usage.ts) | Traditional client-server setup |
| [No Database](./packages/reality-server/examples/no-database.ts) | Server without any database |
| [Drizzle Auto-Invalidation](./packages/reality-server/examples/drizzle-auto-invalidation.ts) | Optional Drizzle integration |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | How Reality works under the hood |
| [Migration Guide](./docs/MIGRATION.md) | Migrate from WebSockets/SSE/Polling |
| [Compatibility](./docs/COMPATIBILITY.md) | Drop-in replacements for gradual migration |
| [Simple Explanation](./docs/SIMPLE_EXPLANATION.md) | Non-technical overview |

## Storage Adapters (Optional)

**Remember: Storage is OPTIONAL. Reality works fine without any database.**

| Adapter | Use Case |
|---------|----------|
| `MemoryStorage` | Development, testing, stateless deployments |
| `SQLStorage` | PostgreSQL, MySQL, SQLite (for metadata persistence) |
| `createDrizzleAdapter` | Drizzle ORM integration (optional) |
| `createPrismaAdapter` | Prisma ORM integration (optional) |
| `DynamoDBStorage` | AWS DynamoDB (for metadata persistence) |

## Invalidation Adapters (Optional)

For convenience, you can connect Reality to your database for automatic invalidation.
**This is optional** - you can always call `server.invalidate()` manually.

| Adapter | Use Case |
|---------|----------|
| `createCallbackInvalidationAdapter` | Custom callback-based invalidation |
| `createDrizzleInvalidationAdapter` | Auto-invalidate when Drizzle writes |
| `createPrismaInvalidationAdapter` | Auto-invalidate when Prisma writes |
| `createSQLInvalidationAdapter` | Auto-invalidate with raw SQL |
| `createCompositeInvalidationAdapter` | Combine multiple adapters |

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
│   │   │   ├── transport/ # Transport abstraction (HTTP, Embedded)
│   │   │   ├── ssr/       # SSR adapters (TanStack, etc.)
│   │   │   ├── react/     # React hooks and context
│   │   │   ├── compat/    # SSE/polling compatibility
│   │   │   └── utils/     # Utility functions
│   │   ├── examples/      # Usage examples
│   │   └── README.md
│   │
│   └── reality-server/    # Server package
│       ├── src/
│       │   ├── storage/   # Storage adapters (optional)
│       │   ├── invalidation/ # Invalidation adapters (optional)
│       │   ├── mesh/      # Mesh coordination
│       │   ├── handlers/  # HTTP handlers
│       │   ├── embedded.ts # Embedded server for SSR
│       │   └── server.ts  # Main server class
│       ├── examples/      # Usage examples
│       └── README.md
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

