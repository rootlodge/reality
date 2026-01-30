/**
 * OLD SSE Server Implementation
 * 
 * This file shows a traditional SSE (Server-Sent Events) approach.
 * Run with: bun run server:old
 * 
 * Problems with this approach:
 * 1. Long-lived connections tie up server resources
 * 2. Load balancers may timeout connections
 * 3. Cannot easily scale horizontally (sticky sessions needed)
 * 4. Connection state must be tracked per client
 * 5. Reconnection logic is complex
 */

import { serve } from 'bun';

interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  timestamp: number;
}

// Track all SSE connections - THIS IS THE PROBLEM
// Memory grows with connections, crashes at scale
const connections = new Set<ReadableStreamController<Uint8Array>>();

// Simulated stock data
const stocks: Record<string, StockPrice> = {
  AAPL: { symbol: 'AAPL', price: 178.50, change: 0, timestamp: Date.now() },
  GOOGL: { symbol: 'GOOGL', price: 141.25, change: 0, timestamp: Date.now() },
  MSFT: { symbol: 'MSFT', price: 378.90, change: 0, timestamp: Date.now() },
  AMZN: { symbol: 'AMZN', price: 178.35, change: 0, timestamp: Date.now() },
};

// Simulate price changes
function updatePrices(): void {
  for (const symbol of Object.keys(stocks)) {
    const stock = stocks[symbol];
    const change = (Math.random() - 0.5) * 2; // -1 to +1
    stock.price = Math.round((stock.price + change) * 100) / 100;
    stock.change = Math.round(change * 100) / 100;
    stock.timestamp = Date.now();
  }
}

// Broadcast to all connections - O(n) where n = number of clients
// At 10,000 clients, this becomes very slow
function broadcast(data: unknown): void {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(message);
  
  for (const controller of connections) {
    try {
      controller.enqueue(bytes);
    } catch {
      // Connection died, remove it
      connections.delete(controller);
    }
  }
}

// Update and broadcast every second
setInterval(() => {
  updatePrices();
  broadcast({
    type: 'price_update',
    stocks: Object.values(stocks),
  });
}, 1000);

serve({
  port: 3001,
  fetch(request) {
    const url = new URL(request.url);
    
    // CORS headers for dev
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    if (url.pathname === '/events') {
      // SSE endpoint - creates a LONG-LIVED CONNECTION
      // This connection will stay open until client disconnects
      // Server must track this connection in memory
      
      let controller: ReadableStreamController<Uint8Array>;
      
      const stream = new ReadableStream({
        start(c) {
          controller = c;
          connections.add(controller);
          
          // Send initial data
          const encoder = new TextEncoder();
          const initial = `data: ${JSON.stringify({
            type: 'initial',
            stocks: Object.values(stocks),
          })}\n\n`;
          controller.enqueue(encoder.encode(initial));
        },
        cancel() {
          // Connection closed by client
          connections.delete(controller);
        },
      });
      
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          // Note: no-transform prevents CDN compression
          // but also means CDN cannot cache
        },
      });
    }
    
    if (url.pathname === '/api/stocks') {
      // REST endpoint for initial data
      return new Response(JSON.stringify(Object.values(stocks)), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Stats endpoint to show problems
    if (url.pathname === '/stats') {
      return new Response(JSON.stringify({
        activeConnections: connections.size,
        memoryUsage: process.memoryUsage(),
        warning: connections.size > 1000 
          ? 'HIGH CONNECTION COUNT - consider Reality migration'
          : null,
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log('🔴 OLD SSE Server running on http://localhost:3001');
console.log('');
console.log('⚠️  Warning: This server has scalability issues:');
console.log('   - Long-lived connections consume server resources');
console.log('   - Cannot scale horizontally without sticky sessions');
console.log('   - Memory grows linearly with client count');
console.log('');
console.log('Endpoints:');
console.log('  GET /events  - SSE stream (problematic)');
console.log('  GET /api/stocks - REST endpoint');
console.log('  GET /stats   - Connection statistics');
