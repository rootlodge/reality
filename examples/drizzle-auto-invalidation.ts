/**
 * @rootlodge/reality-server - Drizzle Auto-Invalidation Example
 * 
 * This example shows how to OPTIONALLY connect Reality to Drizzle
 * for automatic invalidation when your database changes.
 * 
 * IMPORTANT: Reality does NOT own your data or your database.
 * This adapter simply helps you notify Reality when things change.
 * You still own everything - Reality just gets a "ping" that something updated.
 * 
 * NOTE: This is a documentation example. In a real project, you would:
 * - Install drizzle-orm and pg-pool as dependencies
 * - Create your own schema file with table definitions
 */

import { createRealityServer, createDrizzleInvalidationAdapter } from '@rootlodge/reality-server';

// Type definitions for the example
// In a real project, these come from drizzle-orm
interface DrizzleDB {
  insert: (table: unknown) => { values: (v: unknown) => { returning: () => Promise<unknown[]> } };
  update: (table: unknown) => { set: (v: unknown) => { where: (cond: unknown) => { returning: () => Promise<unknown[]> } } };
  delete: (table: unknown) => { where: (cond: unknown) => Promise<void> };
}

// Placeholder for Drizzle setup (you would install drizzle-orm)
// import { drizzle } from 'drizzle-orm/node-postgres';
// import Pool from 'pg-pool';
// const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// const db = drizzle(pool);

// Mock db for this example
const db: DrizzleDB = {} as DrizzleDB;

// ============================================
// 1. Create Reality server
// ============================================

const server = createRealityServer({
  serverId: 'drizzle-example-1',
  port: 3456,
  // No storage config needed - Reality doesn't store your data
});

// ============================================
// 2. OPTIONAL: Create Drizzle invalidation adapter
// ============================================

// This adapter helps you notify Reality when Drizzle writes happen.
// Reality still doesn't see your data - just gets a notification.

const invalidationAdapter = createDrizzleInvalidationAdapter({
  db,
  
  // Map your tables to Reality node keys
  keyExtractor: (tableName: string, operation: 'insert' | 'update' | 'delete', data: unknown) => {
    // Simple mapping: table name = node key
    // e.g., 'posts' table -> 'posts' node
    const baseKey = tableName;
    
    // Optionally create more specific keys for row-level invalidation
    const record = data as { id?: string | number } | undefined;
    if (record?.id) {
      return [`${tableName}:${record.id}`, tableName];
    }
    
    return [baseKey];
  },
});

// Attach adapter to server
server.setInvalidationAdapter(invalidationAdapter);

// ============================================
// 3. Example: Your normal Drizzle operations
// ============================================

// Mock table and eq function for the example
// In a real project: import { posts } from './schema';
// In a real project: import { eq } from 'drizzle-orm';
const posts = {} as unknown;
const eq = (a: unknown, b: unknown) => ({ a, b });

async function createPost(title: string, content: string, authorId: number) {
  // Your normal Drizzle insert
  const [post] = await db.insert(posts).values({
    title,
    content,
    authorId,
  }).returning();
  
  // The invalidation adapter automatically notifies Reality
  // that the 'posts' node changed. You don't have to do anything!
  
  return post;
}

async function updatePost(id: number, title: string) {
  // Your normal Drizzle update
  const [post] = await db.update(posts)
    .set({ title, updatedAt: new Date() })
    .where(eq(posts, id))
    .returning();
  
  // Adapter notifies Reality: 'posts' and 'posts:123' changed
  
  return post;
}

async function deletePost(id: number) {
  // Your normal Drizzle delete
  await db.delete(posts).where(eq(posts, id));
  
  // Adapter notifies Reality: 'posts' changed
}

// ============================================
// 4. Manual invalidation still works
// ============================================

async function manualInvalidation() {
  // You can always manually invalidate if needed
  await server.invalidate('posts');
  await server.invalidateMany(['users', 'comments']);
}

// ============================================
// 5. Start the server (use with your HTTP framework)
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

// With Hono/Cloudflare Workers/Bun:
// export default {
//   fetch: server.getFetchHandler('/reality'),
// };

async function main() {
  // Your server is ready to handle requests
  console.log('Reality server ready with Drizzle auto-invalidation');
  console.log('Your database: Drizzle/PostgreSQL (you own it)');
  console.log('Reality: Just tracking change metadata (version hashes)');
  console.log('');
  console.log('Use server.getFetchHandler() to integrate with your HTTP framework');
}

// ============================================
// Key Points:
// ============================================
//
// 1. The Drizzle adapter is OPTIONAL - you don't need it
// 2. Your database, your schema, your queries - all yours
// 3. Reality never reads or stores your actual data
// 4. The adapter just sends "this changed" pings to Reality
// 5. Same pattern works for Prisma, raw SQL, or any data source
//
// Without the adapter, you just call server.invalidate() manually.
// The adapter just automates that for convenience.

export { server, db, createPost, updatePost, deletePost, manualInvalidation, main };
