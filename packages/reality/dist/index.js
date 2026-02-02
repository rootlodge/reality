"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  BloomRealityFilter: () => BloomRealityFilter,
  EventStore: () => EventStore,
  HttpTransport: () => HttpTransport,
  RealityClient: () => RealityClient,
  RealityEventSchema: () => RealityEventSchema,
  createRealityClient: () => createRealityClient
});
module.exports = __toCommonJS(src_exports);

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
var import_bloom_filters = require("bloom-filters");
var BloomRealityFilter = class _BloomRealityFilter {
  constructor(size = 1e3, errorRate = 0.01) {
    this.filter = import_bloom_filters.BloomFilter.create(size, errorRate);
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
    instance.filter = import_bloom_filters.BloomFilter.fromJSON(json);
    return instance;
  }
  merge(other) {
    throw new Error("Merge not implemented for simple BloomFilter");
  }
};

// src/client/transport.ts
var HttpTransport = class {
  constructor(url) {
    this.url = url;
  }
  async sendFilter(filter) {
    const res = await fetch(`${this.url}/filter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filter,
        origin: "client"
        // TODO: Client ID
      })
    });
    if (!res.ok) throw new Error(`Reality Sync Error: ${res.status}`);
    return res.json();
  }
  async sendEvents(events) {
    const res = await fetch(`${this.url}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events,
        origin: "client"
      })
    });
    if (!res.ok) throw new Error(`Reality Push Error: ${res.status}`);
    return res.json();
  }
};

// src/client/createClient.ts
var import_nanoid = require("nanoid");
var import_eventemitter3 = __toESM(require("eventemitter3"));
var RealityClient = class extends import_eventemitter3.default {
  constructor(options = {}) {
    super();
    this.transports = [];
    this.isSyncing = false;
    this.store = new EventStore();
    this.filter = new BloomRealityFilter();
    this.clientId = (0, import_nanoid.nanoid)();
    if (options.transport) {
      this.transports.push(options.transport);
    } else if (options.peers) {
      this.transports = options.peers.map((p) => {
        return new HttpTransport(p);
      });
    }
    if (options.autoSync !== false) {
      this.startSyncLoop();
    }
  }
  /**
   * Publish an event
   */
  publish(topic, payload) {
    const event = {
      id: (0, import_nanoid.nanoid)(),
      topic,
      payload,
      timestamp: Date.now(),
      origin: this.clientId
    };
    if (this.store.add(event)) {
      this.filter.add(event.id);
      this.emit(topic, event);
      this.emit("*", event);
    }
  }
  /**
   * Subscribe to a topic (alias for on)
   */
  subscribe(topic, cb) {
    this.on(topic, cb);
    return () => this.off(topic, cb);
  }
  /**
   * Get current events for topic
   */
  getEvents(topic) {
    return this.store.getAll().filter((e) => e.topic === topic);
  }
  /**
   * Sync Loop
   */
  startSyncLoop() {
    const jitter = Math.random() * 500 + 500;
    this.syncTimer = setTimeout(() => {
      this.sync().finally(() => {
        this.startSyncLoop();
      });
    }, jitter);
  }
  async sync() {
    if (this.isSyncing) return;
    if (this.transports.length === 0) return;
    this.isSyncing = true;
    try {
      const transport = this.transports[Math.floor(Math.random() * this.transports.length)];
      const { events, serverFilter } = await transport.sendFilter(this.filter.serialize());
      let newCount = 0;
      for (const event of events) {
        if (this.store.add(event)) {
          this.filter.add(event.id);
          this.emit(event.topic, event);
          this.emit("*", event);
          newCount++;
        }
      }
      const serverBloom = BloomRealityFilter.from(serverFilter);
      const missingOnServer = this.store.getMissing((id) => serverBloom.has(id));
      if (missingOnServer.length > 0) {
        await transport.sendEvents(missingOnServer);
      }
    } catch (e) {
      console.warn("[Reality] Sync failed:", e);
    } finally {
      this.isSyncing = false;
    }
  }
  stop() {
    clearTimeout(this.syncTimer);
  }
};
function createRealityClient(options) {
  return new RealityClient(options);
}

// src/core/event.ts
var import_zod = require("zod");
var RealityEventSchema = import_zod.z.object({
  id: import_zod.z.string(),
  topic: import_zod.z.string(),
  payload: import_zod.z.unknown(),
  timestamp: import_zod.z.number(),
  origin: import_zod.z.string()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BloomRealityFilter,
  EventStore,
  HttpTransport,
  RealityClient,
  RealityEventSchema,
  createRealityClient
});
//# sourceMappingURL=index.js.map