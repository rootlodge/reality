// src/server/createServer.ts
import { createServer } from "http";

// src/core/store.ts
var EventStore = class {
  constructor(options = {}) {
    this.events = [];
    this.knownIds = /* @__PURE__ */ new Set();
    this.maxEvents = options.maxEvents ?? 1e4;
    this.ttl = options.ttl ?? 24 * 60 * 60 * 1e3;
  }
  /**
   * Add an event to the store.
   * Returns true if event was new, false if duplicate.
   */
  add(event) {
    if (this.knownIds.has(event.id)) {
      return false;
    }
    this.events.push(event);
    this.knownIds.add(event.id);
    if (this.events.length > this.maxEvents) {
      this.gc();
    }
    return true;
  }
  /**
   * Check if we have an event
   */
  has(id) {
    return this.knownIds.has(id);
  }
  /**
   * Get all events
   */
  getAll() {
    return this.events;
  }
  /**
   * Get events not present in the provided check function (Filter)
   */
  getMissing(hasIt) {
    const missing = [];
    for (const event of this.events) {
      if (!hasIt(event.id)) {
        missing.push(event);
      }
    }
    return missing;
  }
  /**
   * Garbage Collection
   * Remove old events or exceed limit
   */
  gc() {
    const now = Date.now();
    if (this.events.length > this.maxEvents) {
      const excess = this.events.length - this.maxEvents;
      const removed = this.events.splice(0, excess);
      for (const ev of removed) {
        this.knownIds.delete(ev.id);
      }
    }
  }
  /**
   * Clear store
   */
  clear() {
    this.events = [];
    this.knownIds.clear();
  }
};

// src/core/filter.ts
import pkg from "bloom-filters";
var { BloomFilter } = pkg;
var BloomRealityFilter = class _BloomRealityFilter {
  constructor(size = 1e3, errorRate = 0.01) {
    this.filter = BloomFilter.create(size, errorRate);
  }
  add(id) {
    this.filter.add(id);
  }
  has(id) {
    return this.filter.has(id);
  }
  serialize() {
    const json = this.filter.saveAsJSON();
    return JSON.stringify(json);
  }
  static from(serialized) {
    const instance = new _BloomRealityFilter();
    const json = JSON.parse(serialized);
    instance.filter = BloomFilter.fromJSON(json);
    return instance;
  }
  merge(other) {
    throw new Error("Merge not implemented for simple BloomFilter");
  }
};

// src/server/http.ts
async function handleFilterRequest(ctx, body) {
  const peerFilter = BloomRealityFilter.from(body.filter);
  const missingEvents = ctx.store.getMissing((id) => peerFilter.has(id));
  return {
    events: missingEvents,
    serverFilter: ctx.filter.serialize()
  };
}
async function handleEventsRequest(ctx, body) {
  let added = 0;
  for (const event of body.events) {
    if (ctx.store.add(event)) {
      ctx.filter.add(event.id);
      added++;
    }
  }
  return { added };
}

// src/server/createServer.ts
function createRealityServer(options) {
  const store = new EventStore();
  const filter = new BloomRealityFilter();
  const namespace = options.namespace || "default";
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const body = await new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => data += chunk);
      req.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({});
        }
      });
    });
    try {
      if (url.pathname === "/__reality/filter") {
        const result = await handleFilterRequest({ store, filter, namespace }, body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }
      if (url.pathname === "/__reality/events") {
        const result = await handleEventsRequest({ store, filter, namespace }, body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }
      res.writeHead(404);
      res.end("Not Found");
    } catch (error) {
      console.error(error);
      res.writeHead(500);
      res.end("Internal Error");
    }
  });
  const port = options.port || 8787;
  return {
    start: () => {
      server.listen(port, () => {
        console.log(`Reality Server 2.0 running on port ${port}`);
        console.log(`Namespace: ${namespace}`);
      });
    },
    stop: () => server.close()
  };
}

// src/server/embedded.ts
function createEmbeddedRealityServer(options) {
  const namespace = options.namespace || "default";
  let store;
  let filter;
  if (options.hmrSafe && globalThis.__REALITY_STORE__) {
    store = globalThis.__REALITY_STORE__;
    filter = globalThis.__REALITY_FILTER__;
  } else {
    store = new EventStore();
    filter = new BloomRealityFilter();
    if (options.hmrSafe) {
      globalThis.__REALITY_STORE__ = store;
      globalThis.__REALITY_FILTER__ = filter;
    }
  }
  const handleRequest = async (request) => {
    try {
      const url = new URL(request.url);
      const body = await request.json();
      if (url.pathname.endsWith("/filter")) {
        const result = await handleFilterRequest({ store, filter, namespace }, body);
        return Response.json(result);
      }
      if (url.pathname.endsWith("/events")) {
        const result = await handleEventsRequest({ store, filter, namespace }, body);
        return Response.json(result);
      }
      return new Response("Not Found", { status: 404 });
    } catch (e) {
      console.error(e);
      return new Response("Internal Error", { status: 500 });
    }
  };
  return {
    handleRequest,
    store
    // exposed for internal usage if needed
  };
}
export {
  createEmbeddedRealityServer,
  createRealityServer,
  handleEventsRequest,
  handleFilterRequest
};
//# sourceMappingURL=index.mjs.map