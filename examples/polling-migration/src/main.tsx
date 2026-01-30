import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RealityProvider } from '@rootlodge/reality';

// Old polling implementation (for comparison)
import { OldNotificationCenter } from './old-polling-client';

// New Reality implementations
import { NotificationCenter, NotificationCenterCompat } from './new-reality-client';

import './index.css';

type ViewMode = 'old-polling' | 'reality-compat' | 'reality-native';

function App() {
  const [mode, setMode] = useState<ViewMode>('reality-native');

  return (
    <div className="app">
      <header>
        <h1>Polling → Reality Migration Demo</h1>
        <p>Watch the request counts - Reality only fetches when data actually changes!</p>
      </header>

      <nav className="mode-selector">
        <button
          className={mode === 'old-polling' ? 'active' : ''}
          onClick={() => setMode('old-polling')}
        >
          🔴 Old Polling
          <small>Full payload every 2s</small>
        </button>
        <button
          className={mode === 'reality-compat' ? 'active' : ''}
          onClick={() => setMode('reality-compat')}
        >
          🟡 Reality (Polling Compat)
          <small>Version-based skip</small>
        </button>
        <button
          className={mode === 'reality-native' ? 'active' : ''}
          onClick={() => setMode('reality-native')}
        >
          🟢 Reality (Native)
          <small>Event-driven sync</small>
        </button>
      </nav>

      <main>
        <div className="notification-container">
          {mode === 'old-polling' && <OldNotificationCenter />}
          {mode === 'reality-compat' && <NotificationCenterCompat />}
          {mode === 'reality-native' && <NotificationCenter />}
        </div>

        <aside className="comparison">
          <h2>Efficiency Comparison</h2>
          
          {mode === 'old-polling' && (
            <div className="mode-info old">
              <h3>🔴 Traditional Polling</h3>
              <div className="metrics">
                <div className="metric bad">
                  <span className="label">Requests</span>
                  <span className="value">1 every 2 seconds</span>
                </div>
                <div className="metric bad">
                  <span className="label">Payload</span>
                  <span className="value">Full data every time</span>
                </div>
                <div className="metric bad">
                  <span className="label">Wasted</span>
                  <span className="value">~90% of requests</span>
                </div>
              </div>
              <ul>
                <li>❌ Fetches full payload every interval</li>
                <li>❌ No way to know if data changed</li>
                <li>❌ Server serializes response every time</li>
                <li>❌ Bandwidth scales with polling frequency</li>
              </ul>
            </div>
          )}

          {mode === 'reality-compat' && (
            <div className="mode-info compat">
              <h3>🟡 Polling with Reality</h3>
              <div className="metrics">
                <div className="metric ok">
                  <span className="label">Syncs</span>
                  <span className="value">1 every 2 seconds</span>
                </div>
                <div className="metric good">
                  <span className="label">Fetches</span>
                  <span className="value">Only when changed</span>
                </div>
                <div className="metric good">
                  <span className="label">Saved</span>
                  <span className="value">~80% bandwidth</span>
                </div>
              </div>
              <ul>
                <li>✅ Version check is lightweight (~50 bytes)</li>
                <li>✅ Only fetch payload when version changes</li>
                <li>✅ Maintains familiar polling pattern</li>
                <li>🟡 Still has interval-based overhead</li>
              </ul>
            </div>
          )}

          {mode === 'reality-native' && (
            <div className="mode-info native">
              <h3>🟢 Reality Native</h3>
              <div className="metrics">
                <div className="metric great">
                  <span className="label">Syncs</span>
                  <span className="value">On-demand only</span>
                </div>
                <div className="metric great">
                  <span className="label">Fetches</span>
                  <span className="value">Only when changed</span>
                </div>
                <div className="metric great">
                  <span className="label">Saved</span>
                  <span className="value">~95% bandwidth</span>
                </div>
              </div>
              <ul>
                <li>✅ No polling loops - event-driven</li>
                <li>✅ Syncs on focus/visibility changes</li>
                <li>✅ Syncs after mutations</li>
                <li>✅ User-triggered refresh available</li>
                <li>✅ Optimistic updates with rollback</li>
              </ul>
            </div>
          )}

          <div className="bandwidth-visual">
            <h3>Bandwidth Usage (10 minutes)</h3>
            <div className="bars">
              <div className="bar-group">
                <div className="bar old" style={{ height: '200px' }}>
                  <span className="bar-value">~300 requests</span>
                </div>
                <span className="bar-label">Polling</span>
              </div>
              <div className="bar-group">
                <div className="bar compat" style={{ height: '200px' }}>
                  <span className="bar-value">300 syncs</span>
                  <div className="bar-inner" style={{ height: '20%' }}>
                    <span>~30 fetches</span>
                  </div>
                </div>
                <span className="bar-label">Compat</span>
              </div>
              <div className="bar-group">
                <div className="bar native" style={{ height: '40px' }}>
                  <span className="bar-value">~20 total</span>
                </div>
                <span className="bar-label">Native</span>
              </div>
            </div>
            <p className="note">
              Native mode only syncs on focus/visibility, not on a timer
            </p>
          </div>
        </aside>
      </main>

      <footer>
        <div className="how-it-works">
          <h3>How Reality Reduces Bandwidth</h3>
          <div className="steps">
            <div className="step">
              <span className="step-number">1</span>
              <h4>Version Check</h4>
              <p>Client sends: "I have version 5"</p>
              <code>POST /reality/sync</code>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <h4>Server Response</h4>
              <p>Server says: "Current is version 5, no changes"</p>
              <code>~50 bytes</code>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <h4>Skip Fetch</h4>
              <p>Client skips payload fetch - nothing changed!</p>
              <code>0 bytes saved</code>
            </div>
          </div>
          <p className="comparison-note">
            <strong>Polling:</strong> Would fetch ~2KB payload every time<br />
            <strong>Reality:</strong> Only fetches when version actually changes
          </p>
        </div>
      </footer>
    </div>
  );
}

// Wrap in RealityProvider for native mode
const root = createRoot(document.getElementById('root')!);
root.render(
  <RealityProvider
    options={{
      servers: ['http://localhost:3000'],
      debug: true,
    }}
  >
    <App />
  </RealityProvider>
);
