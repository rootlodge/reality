/**
 * @rootlodge/reality - React Context
 * 
 * React context provider for Reality client.
 */

import React, { createContext, useContext, useRef, useEffect } from 'react';
import type { RealityOptions } from '../types';
import { RealityClient, createRealityClient } from '../client/reality-client';

/**
 * React context for Reality client
 */
const RealityContext = createContext<RealityClient | null>(null);

/**
 * Props for RealityProvider
 */
export interface RealityProviderProps {
  children: React.ReactNode;
  /** Reality client options */
  options: RealityOptions;
  /** Pre-created client instance (alternative to options) */
  client?: RealityClient;
}

/**
 * Reality Provider component
 * 
 * Provides Reality client to all child components.
 * 
 * @example
 * ```tsx
 * <RealityProvider options={{ servers: ['https://api.example.com'] }}>
 *   <App />
 * </RealityProvider>
 * ```
 */
export function RealityProvider({ children, options, client: providedClient }: RealityProviderProps) {
  const clientRef = useRef<RealityClient | null>(providedClient ?? null);

  // Create client if not provided
  if (!clientRef.current) {
    clientRef.current = createRealityClient(options);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!providedClient && clientRef.current) {
        clientRef.current.destroy();
      }
    };
  }, [providedClient]);

  return (
    <RealityContext.Provider value={clientRef.current}>
      {children}
    </RealityContext.Provider>
  );
}

/**
 * Hook to access the Reality client
 * 
 * @throws Error if used outside of RealityProvider
 */
export function useRealityClient(): RealityClient {
  const client = useContext(RealityContext);
  
  if (!client) {
    throw new Error(
      'useRealityClient must be used within a RealityProvider. ' +
      'Wrap your app with <RealityProvider options={...}>.'
    );
  }

  return client;
}

/**
 * Hook to check if Reality context is available
 */
export function useHasRealityContext(): boolean {
  return useContext(RealityContext) !== null;
}
