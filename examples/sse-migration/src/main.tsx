import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RealityProvider } from '@rootlodge/reality/react';

// Old SSE implementation (for comparison)
import { OldStockTicker } from './old-sse-client';

// New Reality implementations
import { StockTicker, StockTickerCompat } from './new-reality-client';

import './index.css';

type ViewMode = 'old-sse' | 'reality-compat' | 'reality-native';

function App() {
  const [mode, setMode] = useState<ViewMode>('reality-native');

  return (
    <div className="app">
      <header>
        <h1>SSE → Reality Migration Demo</h1>
        <p>Same UI, different transport. Compare the implementations below.</p>
      </header>

      <nav className="mode-selector">
        <button
          className={mode === 'old-sse' ? 'active' : ''}
          onClick={() => setMode('old-sse')}
        >
          🔴 Old SSE
          <small>Long-lived connection</small>
        </button>
        <button
          className={mode === 'reality-compat' ? 'active' : ''}
          onClick={() => setMode('reality-compat')}
        >
          🟡 Reality (SSE Compat)
          <small>Drop-in replacement</small>
        </button>
        <button
          className={mode === 'reality-native' ? 'active' : ''}
          onClick={() => setMode('reality-native')}
        >
          🟢 Reality (Native)
          <small>Recommended</small>
        </button>
      </nav>

      <main>
        <div className="ticker-container">
          {mode === 'old-sse' && <OldStockTicker />}
          {mode === 'reality-compat' && <StockTickerCompat />}
          {mode === 'reality-native' && <StockTicker />}
        </div>

        <aside className="comparison">
          <h2>Mode Comparison</h2>
          
          {mode === 'old-sse' && (
            <div className="mode-info old">
              <h3>🔴 Old SSE Implementation</h3>
              <ul>
                <li>❌ Long-lived EventSource connection</li>
                <li>❌ Connection stays open indefinitely</li>
                <li>❌ Manual reconnection logic required</li>
                <li>❌ Memory grows with client count</li>
                <li>❌ Requires sticky sessions to scale</li>
              </ul>
              <p className="note">
                Server port: <code>3001</code> (run with <code>bun run server:old</code>)
              </p>
            </div>
          )}

          {mode === 'reality-compat' && (
            <div className="mode-info compat">
              <h3>🟡 Reality SSE Compatibility</h3>
              <ul>
                <li>✅ Drop-in EventSource replacement</li>
                <li>✅ Minimal code changes required</li>
                <li>✅ Uses short-lived HTTP internally</li>
                <li>🟡 Good for gradual migration</li>
                <li>🟡 Slightly more overhead than native</li>
              </ul>
              <p className="note">
                Just replace <code>EventSource</code> with <code>RealityEventSource</code>
              </p>
            </div>
          )}

          {mode === 'reality-native' && (
            <div className="mode-info native">
              <h3>🟢 Reality Native Mode</h3>
              <ul>
                <li>✅ No long-lived connections</li>
                <li>✅ Automatic focus/visibility handling</li>
                <li>✅ Built-in caching & deduplication</li>
                <li>✅ Full TypeScript support</li>
                <li>✅ Scales horizontally without sticky sessions</li>
                <li>✅ Works behind any CDN/load balancer</li>
              </ul>
              <p className="note">
                Server port: <code>3000</code> (run with <code>bun run server</code>)
              </p>
            </div>
          )}

          <div className="migration-steps">
            <h3>Migration Steps</h3>
            <ol>
              <li>
                <strong>Step 1:</strong> Add Reality server handler
                <pre>{`app.post('/reality/sync', realityHandler);`}</pre>
              </li>
              <li>
                <strong>Step 2:</strong> Update nodes when data changes
                <pre>{`await server.updateNode('stocks:all', hash);`}</pre>
              </li>
              <li>
                <strong>Step 3 (Option A):</strong> Drop-in replacement
                <pre>{`// Before
const es = new EventSource('/events');

// After
const es = new RealityEventSource('/events', {
  realityEndpoint: '/reality/sync',
});`}</pre>
              </li>
              <li>
                <strong>Step 3 (Option B):</strong> Native hooks
                <pre>{`const { data } = useReality('stocks:all', {
  fetcher: () => fetch('/api/stocks').then(r => r.json()),
});`}</pre>
              </li>
            </ol>
          </div>
        </aside>
      </main>

      <footer>
        <div className="network-comparison">
          <h3>Network Traffic Comparison</h3>
          <div className="comparison-grid">
            <div className="sse">
              <h4>SSE</h4>
              <p>1 long-lived connection per client</p>
              <p>Server pushes every update</p>
              <p>~100 events/second at scale</p>
            </div>
            <div className="reality">
              <h4>Reality</h4>
              <p>1 short request per sync</p>
              <p>Client pulls on visibility/focus</p>
              <p>~1-2 requests/second typical</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Wrap in RealityProvider for native mode
const root = createRoot(document.getElementById('root')!);
root.render(
  <RealityProvider
    endpoint="http://localhost:3000/reality/sync"
    mode="native"
    syncOnFocus={true}
    syncOnReconnect={true}
  >
    <App />
  </RealityProvider>
);
