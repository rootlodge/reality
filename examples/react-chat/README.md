# React Chat Example

A real-time chat application demonstrating the Reality system's native mode with:

- **No WebSockets** - All communication via short-lived HTTP
- **Optimistic Updates** - Messages appear instantly
- **Automatic Reconciliation** - Server state always wins
- **Focus-based Sync** - Automatically syncs when tab becomes visible

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  useReality  │  │  useMutation │  │  RealityProvider     │  │
│  │  (messages)  │  │  (send msg)  │  │  (client instance)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                 │                                     │
│         └────────┬────────┘                                     │
│                  │                                              │
│         ┌────────▼────────┐                                     │
│         │  Sync Engine    │                                     │
│         │  - Batching     │                                     │
│         │  - Deduping     │                                     │
│         │  - Versioning   │                                     │
│         └────────┬────────┘                                     │
└──────────────────┼──────────────────────────────────────────────┘
                   │
                   │ Short-lived HTTP (POST /reality/sync)
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│                         Server                                   │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Reality Server                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │  Storage    │  │    Mesh     │  │   HTTP Handler  │   │   │
│  │  │  (Memory)   │  │ Coordinator │  │   (Fetch API)   │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Application Logic                         │   │
│  │  - POST /api/messages → Add message → Update node         │   │
│  │  - GET /api/rooms/:id → Return messages                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Running the Example

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the server:
   ```bash
   pnpm run server
   ```

3. In another terminal, start the client:
   ```bash
   pnpm run dev
   ```

4. Open http://localhost:5173 in multiple browser tabs to see real-time sync!

## How It Works

### 1. Subscribing to Messages

```tsx
const { data: messages, isLoading } = useReality<Message[]>(
  `chat:room:${roomId}`,
  {
    fallback: [],
    fetcher: async (key) => {
      const id = key.split(':').pop();
      return fetch(`/api/rooms/${id}`).then(r => r.json());
    },
  }
);
```

### 2. Sending Messages with Optimistic Updates

```tsx
const { mutate } = useMutation<Message, string>(
  `chat:room:${roomId}`,
  async (text) => {
    return fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ roomId, text }),
    }).then(r => r.json());
  },
  {
    optimisticUpdate: (messages, text) => [
      ...messages,
      { id: 'temp', text, pending: true },
    ],
    rollbackOnError: true,
  }
);
```

### 3. Server Updates Node Version

```typescript
// When a message is added:
room.messages.push(message);
const hash = createHash(room.messages);
await server.updateNode(`chat:room:${roomId}`, hash);
```

### 4. Client Syncs Automatically

The client syncs when:
- Component mounts (initial load)
- Window gains focus (user returns to tab)
- After mutation (verify server state)
- Manual refresh button

## Key Features Demonstrated

| Feature | Implementation |
|---------|---------------|
| Real-time updates | Version-based invalidation graph |
| Optimistic UI | `useMutation` with `optimisticUpdate` |
| Automatic rollback | `rollbackOnError: true` |
| Focus-based sync | Built into RealityProvider |
| Type safety | Zod schema validation |
| Payload fetching | Custom `fetcher` function |

## No WebSockets Required!

This chat works entirely with short-lived HTTP requests:

1. Client sends: `POST /reality/sync { known: { "chat:room:general": 5 } }`
2. Server responds: `{ changed: { "chat:room:general": { version: 6, hash: "abc" } } }`
3. Client fetches new data via `fetcher` function
4. UI updates with new messages

The "real-time" feel comes from:
- Immediate optimistic updates
- Sync on focus/visibility
- Sync after mutations
- User-triggered refreshes
