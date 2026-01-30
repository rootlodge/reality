'use strict';

// src/compat/sse.ts
function formatSSEMessage(message) {
  let result = "";
  if (message.id) {
    result += `id: ${message.id}
`;
  }
  if (message.event) {
    result += `event: ${message.event}
`;
  }
  if (message.retry !== void 0) {
    result += `retry: ${message.retry}
`;
  }
  const dataLines = message.data.split("\n");
  for (const line of dataLines) {
    result += `data: ${line}
`;
  }
  result += "\n";
  return result;
}
var SSECompatAdapter = class {
  constructor(config) {
    this.config = {
      transform: (_key, data) => JSON.stringify(data),
      ...config
    };
  }
  /**
   * Handle an SSE-style request
   * 
   * Returns data in SSE format but via a normal HTTP response.
   * Client's EventSource polyfill will need to poll this endpoint.
   * 
   * @param lastEventId - The Last-Event-ID from the client
   * @param keys - Keys to check for updates (derived from URL path)
   * @returns SSE-formatted response body
   */
  async handleRequest(lastEventId, keys) {
    const lastVersion = this.parseEventId(lastEventId);
    const changedNodes = await this.config.storage.listChangedSince(lastVersion);
    const relevantChanges = changedNodes.filter(
      (node) => keys.length === 0 || keys.includes(node.key)
    );
    let body = "";
    let maxVersion = lastVersion;
    for (const node of relevantChanges) {
      let payload = null;
      if (this.config.payloadFetcher) {
        try {
          payload = await this.config.payloadFetcher(node.key);
        } catch {
          continue;
        }
      }
      const message = {
        id: this.createEventId(node),
        event: "update",
        data: this.config.transform(node.key, payload ?? { key: node.key, version: node.version })
      };
      body += formatSSEMessage(message);
      maxVersion = Math.max(maxVersion, node.version);
    }
    if (body === "") {
      const heartbeat = {
        id: `heartbeat:${Date.now()}`,
        event: "heartbeat",
        data: JSON.stringify({ timestamp: Date.now() })
      };
      body = formatSSEMessage(heartbeat);
    }
    return {
      body,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-Reality-Version": String(maxVersion)
      },
      hasChanges: relevantChanges.length > 0
    };
  }
  /**
   * Create a Fetch API handler for SSE-compatible endpoint
   */
  createFetchHandler(getKeysFromRequest) {
    return async (request) => {
      const lastEventId = request.headers.get("Last-Event-ID");
      const keys = getKeysFromRequest(request);
      const result = await this.handleRequest(lastEventId, keys);
      return new Response(result.body, {
        status: 200,
        headers: result.headers
      });
    };
  }
  /**
   * Parse event ID to extract version
   */
  parseEventId(eventId) {
    if (!eventId) return 0;
    const parts = eventId.split(":");
    const version = parseInt(parts[0] ?? "0", 10);
    return isNaN(version) ? 0 : version;
  }
  /**
   * Create event ID from node metadata
   */
  createEventId(node) {
    return `${node.version}:${node.hash}`;
  }
};
function createSSECompatAdapter(config) {
  return new SSECompatAdapter(config);
}

// src/compat/polling.ts
var PollingCompatAdapter = class {
  constructor(config) {
    this.config = config;
  }
  /**
   * Handle a polling-style request
   * 
   * @param keys - Keys to fetch
   * @param ifModifiedSince - Optional version for conditional request
   * @returns Response data and metadata
   */
  async handleRequest(keys, ifModifiedSince) {
    const metas = await this.config.storage.getNodes(keys);
    let maxVersion = 0;
    let hasChanges = false;
    for (const meta of metas.values()) {
      maxVersion = Math.max(maxVersion, meta.version);
      if (ifModifiedSince === void 0 || meta.version > ifModifiedSince) {
        hasChanges = true;
      }
    }
    if (ifModifiedSince !== void 0 && !hasChanges) {
      return {
        data: null,
        headers: {
          "X-Reality-Version": String(maxVersion)
        },
        status: 304,
        modified: false
      };
    }
    const payloads = /* @__PURE__ */ new Map();
    for (const key of keys) {
      if (this.config.payloadFetcher) {
        try {
          const payload = await this.config.payloadFetcher(key);
          payloads.set(key, payload);
        } catch {
        }
      }
    }
    const data = this.config.transform ? this.config.transform(payloads) : Object.fromEntries(payloads);
    return {
      data,
      headers: {
        "Content-Type": "application/json",
        "X-Reality-Version": String(maxVersion),
        "Cache-Control": "no-cache"
      },
      status: 200,
      modified: true
    };
  }
  /**
   * Create a Fetch API handler for polling-compatible endpoint
   */
  createFetchHandler(getKeysFromRequest) {
    return async (request) => {
      const ifModifiedSince = request.headers.get("X-Reality-Version");
      const version = ifModifiedSince ? parseInt(ifModifiedSince, 10) : void 0;
      const keys = getKeysFromRequest(request);
      const result = await this.handleRequest(keys, version);
      if (result.status === 304) {
        return new Response(null, {
          status: 304,
          headers: result.headers
        });
      }
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: result.headers
      });
    };
  }
};
function createPollingCompatAdapter(config) {
  return new PollingCompatAdapter(config);
}

exports.PollingCompatAdapter = PollingCompatAdapter;
exports.SSECompatAdapter = SSECompatAdapter;
exports.createPollingCompatAdapter = createPollingCompatAdapter;
exports.createSSECompatAdapter = createSSECompatAdapter;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map