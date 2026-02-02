# Reality 2.0

> Event-Set Gossip with Probabilistic Awareness

Scale horizontally with a socketless, distributed event system.

## Features

- **No WebSockets**: Uses standard HTTP/2 POST requests.
- **Probabilistic Awareness**: Nodes exchange Bloom Filter summaries instead of full data.
- **Gossip Protocol**: Converges state efficiently across 100k+ concurrent clients.
- **Backend Optional**: Works with standalone servers OR embedded in Next.js/Vite.

## Architecture (ESG-PA)

Reality treats "Truth" not as a single state object, but as a set of events.
Each node (Client or Server) maintains:

1. An **Append-Only Log** of events.
2. A **Bloom Filter** representing "I have seen events {A, B, C}".

Applications sync by exchanging filters:

1. Client sends filter `F_client`.
2. Server calculates `Diff(F_client, Store_server)`.
3. Server returns missing events.
4. Client adds events + updates local filter.
5. (Bidirectional) Client sends missing events to Server.

## Installation

```bash
npm install @rootlodge/reality
```

## Usage

### Client (React)

```tsx
import { useReality, useRealityClient } from "@rootlodge/reality/react";

function App() {
  useRealityClient({
    peers: ["https://reality.example.com"],
    namespace: "my-app",
  });

  const { events, publish } = useReality("chat-room");

  return <button onClick={() => publish({ msg: "Hello" })}>Send</button>;
}
```

### Server (Standalone)

```typescript
import { createRealityServer } from "@rootlodge/reality/server";

const server = createRealityServer({
  port: 8080,
  storage: "memory",
});

server.start();
```

### Server (Embedded / Next.js)

```typescript
// app/api/reality/route.ts
import { createEmbeddedRealityServer } from "@rootlodge/reality/server";

const server = createEmbeddedRealityServer({
  hmrSafe: true,
});

export const POST = server.handleRequest;
```
