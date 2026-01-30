/**
 * @rootlodge/reality - TanStack Start SSR Example
 * 
 * This example demonstrates using Reality with TanStack Start for SSR.
 * Reality does NOT own your data - it only tracks change metadata (version hashes).
 * Your database, your queries, your control.
 * 
 * NOTE: This is a documentation example showing the patterns.
 * Actual implementation would be in .tsx files with proper React imports.
 */

import { createReality, createRealityTanStackAdapter, createSSRContext } from '@rootlodge/reality';

// ============================================
// 1. Create Reality client with SSR support
// ============================================

const reality = createReality({
  // In TanStack SSR, use 'ssr-embedded' mode - no external server needed
  executionMode: 'ssr-embedded',
  
  // No servers array needed in embedded mode
  servers: [],
});

// ============================================
// 2. Create TanStack adapter
// ============================================

const realityAdapter = createRealityTanStackAdapter({
  // Keys to prefetch during SSR
  keys: ['posts', 'user:123'],
  
  // Optional: server ID for the embedded server
  serverId: 'tanstack-ssr',
});

// ============================================
// 3. Use in TanStack Start routes
// ============================================

// In your route loader (server-side):
// Note: 'db' would be your Drizzle/Prisma/etc database instance
async function loader(db: { query: { posts: { findMany: () => Promise<Array<{ id: number; title: string }>> } } }) {
  // Create SSR context for this request
  const ssrContext = createSSRContext();
  
  // Your normal data fetching - Reality doesn't interfere
  const posts = await db.query.posts.findMany();
  
  // Prefetch Reality nodes for hydration
  const realityState = await realityAdapter.prefetch();
  
  return {
    posts,
    // Include Reality state for client hydration
    realityState,
  };
}

// ============================================
// 4. Invalidation from mutations
// ============================================

// In your mutation action:
// Note: 'db' and 'posts' schema would be your database setup
async function createPostAction(
  formData: FormData,
  db: { insert: (table: unknown) => { values: (v: unknown) => { returning: () => Promise<Array<{ id: number }>> } } },
  postsTable: unknown
) {
  // Your normal database write
  const post = await db.insert(postsTable).values({
    title: formData.get('title') as string,
    content: formData.get('content') as string,
  }).returning();
  
  // Tell Reality this data changed (just metadata, not the actual data)
  await realityAdapter.invalidate(['posts']);
  
  return post;
}

// ============================================
// 5. Subscribe to changes in components
// ============================================

// Example component pattern (would be in a .tsx file):
// 
// function PostsList() {
//   const { data: posts, refetch } = useQuery({
//     queryKey: ['posts'],
//     queryFn: () => fetch('/api/posts').then(r => r.json()),
//   });
//   
//   useEffect(() => {
//     const unsubscribe = reality.subscribe(['posts'], () => {
//       refetch();
//     });
//     return unsubscribe;
//   }, [refetch]);
//   
//   return (
//     <ul>
//       {posts?.map(post => (
//         <li key={post.id}>{post.title}</li>
//       ))}
//     </ul>
//   );
// }

// ============================================
// Key Points:
// ============================================
// 
// 1. Reality DOES NOT store your data - it only tracks version hashes
// 2. You own your database, your queries, your data fetching
// 3. Reality just tells you "this thing changed" - you decide what to do
// 4. SSR mode means no external WebSocket server needed
// 5. Works with any data layer: Drizzle, Prisma, raw SQL, REST APIs, etc.

export { reality, realityAdapter, loader, createPostAction };
