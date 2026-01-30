/**
 * @rootlodge/reality-server - Drizzle Auto-Invalidation Example
 * 
 * This example shows how to OPTIONALLY connect Reality to Drizzle
 * for automatic invalidation when your database changes.
 * 
 * IMPORTANT: Reality does NOT own your data or your database.
 * This adapter simply helps you notify Reality when things change.
 * You still own everything - Reality just gets a "ping" that something updated.
 */

import { createRealityServer, createDrizzleInvalidationAdapter } from '@rootlodge/reality-server';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import Pool from 'pg-pool';

// ============================================
// 1. Your normal Drizzle setup (you own this)
// ============================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// ============================================
// 2. Create Reality server (no storage needed)
// ============================================

const server = createRealityServer({
  port: 3456,
  // No storage config - Reality doesn't need to store your data
});

// ============================================
// 3. OPTIONAL: Create Drizzle invalidation adapter
// ============================================

// This adapter helps you notify Reality when Drizzle writes happen.
// Reality still doesn't see your data - just gets a notification.

const invalidationAdapter = createDrizzleInvalidationAdapter({
  db,
  
  // Map your tables to Reality node keys
  tableToNodeKey: (tableName, operation, affectedIds) => {
    // Simple mapping: table name = node key
    // e.g., 'posts' table -> 'posts' node
    const baseKey = tableName;
    
    // Optionally create more specific keys for row-level invalidation
    if (affectedIds && affectedIds.length === 1) {
      return [`${tableName}:${affectedIds[0]}`, tableName];
    }
    
    return [baseKey];
  },
  
  // Optional: Custom version hash generation
  generateVersion: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
});

// Attach adapter to server
server.setInvalidationAdapter(invalidationAdapter);

// ============================================
// 4. Example: Your normal Drizzle operations
// ============================================

// When you write to the database, Reality automatically gets notified

import { posts, users } from './schema';  // Your schema
import { eq } from 'drizzle-orm';

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
    .where(eq(posts.id, id))
    .returning();
  
  // Adapter notifies Reality: 'posts' and 'posts:123' changed
  
  return post;
}

async function deletePost(id: number) {
  // Your normal Drizzle delete
  await db.delete(posts).where(eq(posts.id, id));
  
  // Adapter notifies Reality: 'posts' changed
}

// ============================================
// 5. Manual invalidation still works
// ============================================

// You can always manually invalidate if needed
await server.invalidate('posts');
await server.invalidateMany(['users', 'comments']);

// ============================================
// 6. Start the server
// ============================================

await server.start();

console.log('Reality server running with Drizzle auto-invalidation');
console.log('Your database: Drizzle/PostgreSQL (you own it)');
console.log('Reality: Just tracking change metadata (version hashes)');

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

export { server, db, createPost, updatePost, deletePost };
