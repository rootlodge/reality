/**
 * OLD Client Implementation using EventSource (SSE)
 * 
 * This file shows traditional SSE client code.
 * Keep this for reference during migration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  timestamp: number;
}

interface StockUpdate {
  type: 'initial' | 'price_update';
  stocks: StockPrice[];
}

/**
 * OLD Hook: useSSEStocks
 * 
 * Problems:
 * 1. EventSource holds connection open indefinitely
 * 2. Reconnection logic is manual and error-prone
 * 3. No automatic handling of visibility/focus
 * 4. Memory leaks if cleanup is missed
 */
export function useSSEStocks() {
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Create SSE connection - THIS STAYS OPEN
      const es = new EventSource('http://localhost:3001/events');
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      es.onmessage = (event) => {
        try {
          const data: StockUpdate = JSON.parse(event.data);
          setStocks(data.stocks);
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        setError(new Error('SSE connection failed'));
        es.close();

        // Manual reconnection logic
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect'));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup - easy to forget!
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { stocks, isConnected, error };
}

/**
 * OLD Component using SSE
 */
export function OldStockTicker() {
  const { stocks, isConnected, error } = useSSEStocks();

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="stock-ticker">
      <div className="connection-status">
        {isConnected ? '🟢 Connected (SSE)' : '🔴 Disconnected'}
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
    </div>
  );
}
