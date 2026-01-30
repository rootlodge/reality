/**
 * @rootlodge/reality - TanStack Start SSR Example
 * 
 * This example demonstrates using Reality with TanStack Start for SSR.
 * Reality does NOT own your data - it only tracks change metadata (version hashes).
 * Your database, your queries, your control.
 */

import { createReality, createRealityTanStackAdapter, createSSRContext } from '@rootlodge/reality';

// ============================================
// 1. Create Reality client with SSR support
// ============================================

const reality = createReality({
  // In TanStack SSR, use 'ssr-embedded' mode - no external server needed
  executionMode: 'ssr-embedded',
  
  // No persistence needed - Reality only tracks metadata
  persistence: 'none',
  
  // No servers array needed in embedded mode
  servers: [],
});

// ============================================
// 2. Create TanStack adapter
// ============================================

const realityAdapter = createRealityTanStackAdapter({
  reality,
  
  // Optional: Custom invalidation behavior
  defaultInvalidation: {
    broadcast: true,
    immediate: true,
  },
});

// ============================================
// 3. Use in TanStack Start routes
// ============================================

// In your route loader (server-side):
async function loader() {
  // Create SSR context for this request
  const ssrContext = createSSRContext();
  
  // Your normal data fetching - Reality doesn't interfere
  const posts = await db.query.posts.findMany();
  
  // Optionally prefetch Reality nodes for hydration
  await realityAdapter.prefetch(['posts', 'user:123']);
  
  return {
    posts,
    // Include Reality state for client hydration
    realityState: ssrContext.serialize(),
  };
}

// ============================================
// 4. Invalidation from mutations
// ============================================

// In your mutation action:
async function createPostAction(formData: FormData) {
  // Your normal database write
  const post = await db.insert(posts).values({
    title: formData.get('title') as string,
    content: formData.get('content') as string,
  }).returning();
  
  // Tell Reality this data changed (just metadata, not the actual data)
  await realityAdapter.invalidate('posts');
  
  return post;
}

// ============================================
// 5. Subscribe to changes in components
// ============================================

function PostsList() {
  // Your normal TanStack query
  const { data: posts, refetch } = useQuery({
    queryKey: ['posts'],
    queryFn: () => fetch('/api/posts').then(r => r.json()),
  });
  
  // When Reality detects changes, refetch your data
  useEffect(() => {
    const unsubscribe = reality.subscribe(['posts'], () => {
      // Reality says "posts changed" - you decide what to do
      refetch();
    });
    
    return unsubscribe;
  }, [refetch]);
  
  return (
    <ul>
      {posts?.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

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
