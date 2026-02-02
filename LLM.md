# Reality 2.0 Context for LLMs

Reality 2.0 is a distributed event synchronization system based on **Event-Set Gossip with Probabilistic Awareness (ESG-PA)**.

## Core Concepts

### 1. The Filter (Truth Representation)

Instead of versions numbers (v1, v2), Reality uses a **Bloom Filter** to represent the set of known event IDs.

- **False Positives**: Possible. A node might think it has an event when it doesn't.
- **Consequence**: The node misses receiving that event _for this sync round_.
- **Recovery**: Random jitter and probabilistic properties mean it will likely get it next round or from another peer.

### 2. The Gossip Loop

Protocol flow:

1. **Client** -> `POST /__reality/filter` `{ filter: "bloom_json" }`
2. **Server** Diffs `Store` vs `bloom_json`.
3. **Server** -> Returns `{ events: [MissingEvents], serverFilter: "bloom_json" }`.
4. **Client** Diffs `LocalStore` vs `serverFilter`.
5. **Client** (if needed) -> `POST /__reality/events` `{ events: [Msg] }`.

### 3. Event Structure

```typescript
interface RealityEvent {
  id: string; // nanoid
  topic: string; // channel
  payload: unknown; // data
  timestamp: number;
  origin: string; // node_id
}
```

## Scaling

- **Cost**: Proportional to _changes_ (diff size), not connection time.
- **Fan-out**: Handled by peer-to-peer gossip (Server is just a super-peer).
- **Concurrency**: Stateless HTTP requests allow infinite horizontal scaling of servers (using a shared Redis/Mesh backend, though single-node memory is default for MVP's).

## Developer Rules

1. **Never use WebSockets**.
2. **Never assume order** (unless sorting by timestamp manually).
3. **Always use append-only** logic.
