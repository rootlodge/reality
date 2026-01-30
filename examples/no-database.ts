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
  serverId: 'no-db-example',
  
  // No storage configuration = pure in-memory operation
  // Version hashes live only in memory
  // Perfect for development or when persistence isn't needed
});

// ============================================
// 2. Use with your HTTP framework
// ============================================

// Reality server doesn't have a built-in HTTP server.
// Use the fetch handler with your preferred framework:

// With Express:
// import express from 'express';
// const app = express();
// app.use('/reality', async (req, res) => {
//   const response = await server.getFetchHandler()(new Request(...));
//   // ... handle response
// });
// app.listen(3456);

// With Hono/Bun:
// export default {
//   fetch: server.getFetchHandler('/reality'),
// };

console.log('Reality server ready');
console.log('No database required - tracking changes in memory');

// ============================================
// 3. Programmatic invalidation
// ============================================

// When your app updates data, tell Reality about it
// This is all Reality needs - just a notification that something changed

async function exampleInvalidations() {
  // Single node invalidation
  await server.invalidate('posts');

  // Multiple nodes at once
  await server.invalidateMany(['posts', 'users', 'comments']);
}

// ============================================
// 4. What Reality does with this:
// ============================================
//
// 1. Updates internal version hash for the node
// 2. When clients sync, they discover the new version
// 3. Clients can then refetch from YOUR data source
//
// Reality never sees or stores your actual data!

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
// To add persistence (optional), provide custom storage:
//
// import { createSQLStorage } from '@rootlodge/reality-server/storage';
// const storage = createSQLStorage({...});
// const server = createRealityServer({ serverId: '...' }, storage);

export { server, exampleInvalidations };
