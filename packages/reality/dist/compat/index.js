'use strict';

// src/compat/sse.ts
var SSEReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
};
var RealityEventSource = class {
  constructor(url, client, options = {}) {
    // EventSource API compatibility
    this.CONNECTING = SSEReadyState.CONNECTING;
    this.OPEN = SSEReadyState.OPEN;
    this.CLOSED = SSEReadyState.CLOSED;
    this.readyState = SSEReadyState.CONNECTING;
    this.withCredentials = false;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.unsubscribe = null;
    this.eventListeners = /* @__PURE__ */ new Map();
    this.lastEventId = "";
    this.url = url;
    this.client = client;
    this.realityKey = options.realityKey ?? this.urlToKey(url);
    this.transform = options.transform ?? JSON.stringify;
    this.connect(options);
  }
  /**
   * Add event listener (EventSource API)
   */
  addEventListener(type, listener) {
    let listeners = this.eventListeners.get(type);
    if (!listeners) {
      listeners = /* @__PURE__ */ new Set();
      this.eventListeners.set(type, listeners);
    }
    listeners.add(listener);
  }
  /**
   * Remove event listener (EventSource API)
   */
  removeEventListener(type, listener) {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  /**
   * Dispatch event to listeners
   */
  dispatchEvent(type, event) {
    if (type === "message" && this.onmessage) {
      this.onmessage(event);
    }
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
  /**
   * Close the connection (EventSource API)
   */
  close() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.readyState = SSEReadyState.CLOSED;
  }
  /**
   * Connect to Reality node
   */
  connect(options) {
    const keyOptions = {
      staleTime: options.staleTime ?? 3e4,
      refetchOnFocus: true,
      refetchOnReconnect: true
    };
    this.unsubscribe = this.client.subscribe(
      this.realityKey,
      (state) => {
        this.handleStateChange(state);
      },
      keyOptions
    );
  }
  /**
   * Handle Reality state changes
   */
  handleStateChange(state) {
    if (this.readyState === SSEReadyState.CONNECTING && !state.isLoading) {
      this.readyState = SSEReadyState.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }
    if (state.error) {
      if (this.onerror) {
        this.onerror(new Event("error"));
      }
      return;
    }
    if (state.data !== void 0 && state.meta) {
      const eventId = `${state.meta.version}-${state.meta.hash}`;
      if (eventId !== this.lastEventId) {
        this.lastEventId = eventId;
        const event = {
          data: this.transform(state.data),
          lastEventId: eventId,
          origin: this.url,
          type: "message"
        };
        this.dispatchEvent("message", event);
      }
    }
  }
  /**
   * Convert URL to Reality key
   */
  urlToKey(url) {
    return url.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "").replace(/^\//, "").replace(/\//g, ":");
  }
};
function createEventSource(url, client, options = {}) {
  return new RealityEventSource(url, client, options);
}
function createEventSourceFactory(client) {
  return class extends RealityEventSource {
    constructor(url, options) {
      super(url, client, options);
    }
  };
}

// src/compat/polling.ts
function createPollingAdapter(url, callback, client, options = {}) {
  const realityKey = options.realityKey ?? urlToKey(url);
  let isActive = true;
  let lastSyncTime = null;
  let unsubscribe = null;
  const keyOptions = {
    fallback: options.initial,
    transform: options.transform,
    refetchOnFocus: options.syncOnFocus ?? true,
    refetchOnReconnect: true
  };
  unsubscribe = client.subscribe(
    realityKey,
    (state) => {
      if (!isActive) return;
      if (state.lastSyncAt) {
        lastSyncTime = state.lastSyncAt;
      }
      if (state.data !== void 0 && !state.isLoading && !state.error) {
        callback(state.data);
      }
    },
    keyOptions
  );
  if (options.syncOnVisibility !== false && typeof document !== "undefined") {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isActive) {
        client.syncKeys([realityKey], "focus");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  return {
    sync: async (hint = "interaction") => {
      if (isActive) {
        await client.syncKeys([realityKey], hint);
      }
    },
    stop: () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
    isActive: () => isActive,
    getLastSyncTime: () => lastSyncTime
  };
}
function createBatchPollingAdapter(configs, client) {
  const adapters = /* @__PURE__ */ new Map();
  for (const config of configs) {
    const adapter = createPollingAdapter(
      config.url,
      config.callback,
      client,
      config.options
    );
    adapters.set(config.url, adapter);
  }
  return {
    adapters,
    syncAll: async (hint = "interaction") => {
      const keys = configs.map((c) => c.options?.realityKey ?? urlToKey(c.url));
      await client.syncKeys(keys, hint);
    },
    stopAll: () => {
      for (const adapter of adapters.values()) {
        adapter.stop();
      }
    }
  };
}
function withInteractionSync(control, callback) {
  return () => {
    control.sync("interaction");
    callback?.();
  };
}
function urlToKey(url) {
  return url.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "").replace(/^\//, "").replace(/\//g, ":");
}

exports.RealityEventSource = RealityEventSource;
exports.SSEReadyState = SSEReadyState;
exports.createBatchPollingAdapter = createBatchPollingAdapter;
exports.createEventSource = createEventSource;
exports.createEventSourceFactory = createEventSourceFactory;
exports.createPollingAdapter = createPollingAdapter;
exports.withInteractionSync = withInteractionSync;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map