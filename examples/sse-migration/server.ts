/**
 * NEW Reality Server Implementation
 * 
 * This file shows the Reality approach - identical behavior, no long-lived connections.
 * Run with: bun run server
 * 
 * Benefits:
 * 1. No long-lived connections - scales horizontally
 * 2. No sticky sessions required
 * 3. Works behind any CDN/load balancer
 * 4. Memory usage is constant regardless of client count
 * 5. Built-in mesh coordination for multi-server setups
 */

import { createRealityServer, createHash } from '@rootlodge/reality-server';

interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  timestamp: number;
}

// Initialize Reality server - stateless, mesh-aware
const server = createRealityServer({
  serverId: `stock-server-${Date.now()}`,
});

// Simulated stock data
const stocks: Record<string, StockPrice> = {
  AAPL: { symbol: 'AAPL', price: 178.50, change: 0, timestamp: Date.now() },
  GOOGL: { symbol: 'GOOGL', price: 141.25, change: 0, timestamp: Date.now() },
  MSFT: { symbol: 'MSFT', price: 378.90, change: 0, timestamp: Date.now() },
  AMZN: { symbol: 'AMZN', price: 178.35, change: 0, timestamp: Date.now() },
};

// Simulate price changes
async function updatePrices(): Promise<void> {
  for (const symbol of Object.keys(stocks)) {
    const stock = stocks[symbol];
    const change = (Math.random() - 0.5) * 2;
    stock.price = Math.round((stock.price + change) * 100) / 100;
    stock.change = Math.round(change * 100) / 100;
    stock.timestamp = Date.now();
  }
  
  // Update all stock nodes with new version
  // No broadcast needed - clients will detect changes on next sync
  for (const symbol of Object.keys(stocks)) {
    const stock = stocks[symbol];
    // Hash is based on price and timestamp to detect changes
    const hash = createHash(`${stock.price}-${stock.timestamp}`);
    await server.updateNode(`stocks:${symbol}`, hash);
  }
  
  // Also update an "all stocks" aggregate node
  const allHash = createHash(Object.values(stocks)
    .map(s => `${s.symbol}:${s.price}`)
    .join('|'));
  await server.updateNode('stocks:all', allHash);
}

// Update prices every second
setInterval(updatePrices, 1000);

// Initial update
updatePrices();

Bun.serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Reality sync endpoint - handles all real-time coordination
    if (url.pathname === '/reality/sync') {
      const response = await server.handleRequest(request);
      // Add CORS headers
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }
    
    // REST endpoint for fetching stock data
    if (url.pathname === '/api/stocks') {
      return new Response(JSON.stringify(Object.values(stocks)), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Individual stock endpoint
    const stockMatch = url.pathname.match(/^\/api\/stocks\/([A-Z]+)$/);
    if (stockMatch) {
      const symbol = stockMatch[1];
      const stock = stocks[symbol];
      if (!stock) {
        return new Response(JSON.stringify({ error: 'Stock not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(stock), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Stats endpoint
    if (url.pathname === '/stats') {
      const stats = server.getStats();
      return new Response(JSON.stringify({
        activeConnections: 0, // Reality has NO persistent connections!
        serverId: stats.serverId,
        uptime: stats.uptime,
        mesh: stats.mesh,
        memoryUsage: process.memoryUsage(),
        note: 'Memory usage stays constant regardless of client count',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log('✅ Reality Server running on http://localhost:3000');
console.log('');
console.log('Benefits over SSE:');
console.log('   ✓ No long-lived connections');
console.log('   ✓ Scales horizontally without sticky sessions');
console.log('   ✓ Memory stays constant regardless of clients');
console.log('   ✓ Works behind any CDN/load balancer');
console.log('');
console.log('Endpoints:');
console.log('  POST /reality/sync  - Reality sync (short-lived HTTP)');
console.log('  GET  /api/stocks    - REST endpoint');
console.log('  GET  /events        - SSE compat (for migration)');
console.log('  GET  /stats         - Server statistics');
