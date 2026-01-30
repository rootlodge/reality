/**
 * NEW Client Implementation using Reality
 * 
 * This file shows the Reality approach - identical UI behavior, better internals.
 * 
 * Migration steps:
 * 1. Replace EventSource with RealityEventSource (drop-in replacement)
 * 2. OR use native useReality hook (recommended)
 */

import { useReality } from '@rootlodge/reality/react';
import { RealityEventSource } from '@rootlodge/reality/compat';
import { useState, useEffect, useCallback, useRef } from 'react';

interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  timestamp: number;
}

/**
 * MIGRATION OPTION 1: Drop-in EventSource replacement
 * 
 * Minimal code changes - just swap EventSource for RealityEventSource.
 * Internally uses short-lived HTTP instead of long-lived connections.
 * 
 * Good for: Quick migration, testing, gradual rollout
 */
export function useSSECompatStocks() {
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<RealityEventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // RealityEventSource is a drop-in replacement for EventSource
      // Same API, but uses short-lived HTTP internally
      const es = new RealityEventSource('http://localhost:3000/events', {
        // Reality-specific options
        realityEndpoint: 'http://localhost:3000/reality/sync',
        syncInterval: 1000, // Check for updates every second
      });
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStocks(data.stocks || data);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        setError(new Error('Connection failed'));
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect'));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => eventSourceRef.current?.close();
  }, [connect]);

  return { stocks, isConnected, error };
}

/**
 * MIGRATION OPTION 2: Native Reality hook (RECOMMENDED)
 * 
 * Full Reality integration with:
 * - Automatic focus/visibility handling
 * - Built-in caching and deduplication
 * - Type safety with TypeScript
 * - Better developer experience
 * 
 * Good for: New features, full migration, best performance
 */
export function useRealityStocks() {
  const { data: stocks, isLoading, error, isSyncing, sync } = useReality<StockPrice[]>(
    'stocks:all',
    {
      fallback: [],
      
      // Fetcher retrieves actual payload when version changes
      fetcher: async () => {
        const response = await fetch('http://localhost:3000/api/stocks');
        return response.json();
      },
      
      // Stale time before background refresh
      staleTime: 500,
      
      // Dedupe rapid requests
      dedupeInterval: 100,
    }
  );

  return {
    stocks: stocks ?? [],
    isConnected: !isLoading && !error,
    isLoading,
    isSyncing,
    error,
    refresh: sync,
  };
}

/**
 * NEW Component using Reality (native mode)
 * 
 * UI is IDENTICAL to the old SSE version.
 * Only the data fetching mechanism changed.
 */
export function StockTicker() {
  const { stocks, isConnected, isSyncing, error, refresh } = useRealityStocks();

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="stock-ticker">
      <div className="connection-status">
        <span>{isConnected ? '🟢 Connected (Reality)' : '🔴 Disconnected'}</span>
        {isSyncing && <span className="syncing">Syncing...</span>}
        <button onClick={refresh} disabled={isSyncing}>
          Refresh
        </button>
      </div>
      <div className="stocks">
        {stocks.map((stock) => (
          <div key={stock.symbol} className="stock">
            <span className="symbol">{stock.symbol}</span>
            <span className="price">${stock.price.toFixed(2)}</span>
            <span className={`change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
              {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="stats">
        <small>
          No WebSockets • No SSE streams • Just HTTP
        </small>
      </div>
    </div>
  );
}

/**
 * Component using SSE compatibility layer
 * 
 * Minimal code changes from original SSE implementation.
 * Good for gradual migration or A/B testing.
 */
export function StockTickerCompat() {
  const { stocks, isConnected, error } = useSSECompatStocks();

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="stock-ticker compat">
      <div className="connection-status">
        {isConnected ? '🟡 Connected (SSE Compat)' : '🔴 Disconnected'}
      </div>
      <div className="stocks">
        {stocks.map((stock) => (
          <div key={stock.symbol} className="stock">
            <span className="symbol">{stock.symbol}</span>
            <span className="price">${stock.price.toFixed(2)}</span>
            <span className={`change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
              {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="stats">
        <small>
          Using RealityEventSource (drop-in EventSource replacement)
        </small>
      </div>
    </div>
  );
}
