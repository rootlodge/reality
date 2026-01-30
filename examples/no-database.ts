/**
 * @rootlodge/reality-server - No Database Example
 * 
 * This example demonstrates using Reality server WITHOUT any database.
 * Reality does NOT need to store your data - it only tracks change metadata.
 * You own your data. Reality just coordinates invalidation.
 */

import { createRealityServer } from '@rootlodge/reality-server';

// ============================================
// 1. Create server with NO storage
// ============================================

// Reality can run entirely without a database!
// It tracks version hashes in memory for change detection.
const server = createRealityServer({
  port: 3456,
  
  // No storage configuration = pure in-memory operation
  // Version hashes live only in memory
  // Perfect for development or when persistence isn't needed
});

// ============================================
// 2. Start the server
// ============================================

await server.start();
console.log('Reality server running at localhost:3456');
console.log('No database required - tracking changes in memory');

// ============================================
// 3. Programmatic invalidation
// ============================================

// When your app updates data, tell Reality about it
// This is all Reality needs - just a notification that something changed

// Single node invalidation
await server.invalidate('posts');

// Multiple nodes at once
await server.invalidateMany(['posts', 'users', 'comments']);

// With metadata (optional)
await server.invalidate('user:123', {
  reason: 'profile-updated',
  source: 'api',
  timestamp: Date.now(),
});

// ============================================
// 4. What Reality does with this:
// ============================================
//
// 1. Updates internal version hash for the node
// 2. Broadcasts "this changed" to all connected clients
// 3. Clients receive notification and can refetch from YOUR data source
//
// Reality never sees or stores your actual data!

// ============================================
// 5. Graceful shutdown
// ============================================

process.on('SIGTERM', async () => {
  await server.stop();
  console.log('Server stopped gracefully');
});

// ============================================
// Key Points:
// ============================================
//
// 1. No database configuration = works out of the box
// 2. Version hashes stored in memory (reset on restart)
// 3. Perfect for development, testing, or stateless deployments
// 4. For persistence across restarts, add optional storage
// 5. Your app owns the data - Reality just coordinates
//
// To add persistence (optional):
//
// const server = createRealityServer({
//   port: 3456,
//   storage: {
//     type: 'sqlite',
//     path: './reality-metadata.db',  // Only stores hashes, not your data!
//   },
// });

export { server };
