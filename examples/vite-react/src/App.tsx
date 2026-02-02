import React from 'react';
import { useReality, useRealityClient } from '@rootlodge/reality/react';

function Counter() {
  const { events, publish } = useReality('count');
  
  const count = events.reduce((acc, event) => {
    return acc + (event.payload as number);
  }, 0);

  return (
    <div style={{ padding: 20, border: '1px solid #333', borderRadius: 8 }}>
      <h2>Count: {count}</h2>
      <p style={{ color: '#888' }}>Events: {events.length}</p>
      <button onClick={() => publish(1)}>+1</button>
      <button onClick={() => publish(-1)}>-1</button>
    </div>
  );
}

export default function App() {
  // Initialize Client
  useRealityClient({
    peers: ['http://localhost:8787'],
    namespace: 'vite-example'
  });

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 600, margin: '0 auto' }}>
      <h1>Reality 2.0 Example</h1>
      <p>Open this in multiple tabs. Click buttons and watch sync.</p>
      <Counter />
      
      <div style={{ marginTop: 20 }}>
        <h3>Debug Info</h3>
        <p>Gossip Loop Jitter: 500-1000ms</p>
      </div>
    </div>
  );
}
