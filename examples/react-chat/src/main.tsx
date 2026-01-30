import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RealityProvider } from '@rootlodge/reality';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RealityProvider
      options={{
        servers: ['http://localhost:3001'],
        mode: 'native',
        debug: true,
      }}
    >
      <App />
    </RealityProvider>
  </StrictMode>
);
