/**
 * @rootlodge/reality - SSR Embedded Mode Example
 * 
 * For SSR frameworks (TanStack Start, Next.js, Nuxt, etc.), you can run
 * Reality entirely in-process without any external WebSocket server.
 * 
 * This is the 'ssr-embedded' execution mode.
 * 
 * NOTE: This is a documentation example showing the patterns.
 * Variables like 'db', 'getSession', etc. represent YOUR implementations.
 */

import { 
  createReality, 
  getEmbeddedServer,
} from '@rootlodge/reality';
import { createEmbeddedRealityServer } from '@rootlodge/reality-server';

// ============================================
// 1. Create embedded server (runs in your SSR process)
// ============================================

// This runs IN your SSR process - no external server needed
const embeddedServer = createEmbeddedRealityServer({
  // Server ID for this instance (useful for debugging)
  serverId: 'ssr-embedded-1',
  
  // No storage needed - metadata lives in memory
  // For persistence across SSR restarts, you can add storage
});

// ============================================
// 2. Create Reality client in embedded mode
// ============================================

const reality = createReality({
  // Embedded mode: talks directly to in-process server
  executionMode: 'ssr-embedded',
  
  // No external servers needed
  servers: [],
});

// ============================================
// 3. SSR request handling
// ============================================

// Type definitions for the example
interface User { id: string; name: string }
interface Post { id: number; title: string }
interface Session { userId: string }
interface Database {
  query: {
    posts: { findMany: () => Promise<Post[]> };
    users: { findFirst: (opts: { where: { id: string } }) => Promise<User> };
  };
  insert: (table: unknown) => { values: (v: unknown) => { returning: () => Promise<Post[]> } };
}

// Placeholder types - in your app, these would be your actual implementations
declare const db: Database;
declare function getSession(request: Request): Session;
declare function renderPage(data: { posts: Post[]; user: User }): Promise<string>;

// In your SSR request handler / route loader:
async function handleSSRRequest(request: Request) {
  // 1. Your normal data fetching
  const posts = await db.query.posts.findMany();
  const user = await db.query.users.findFirst({
    where: { id: getSession(request).userId }
  });
  
  // 2. Track what data was used in this render
  // This is useful for knowing what to invalidate later
  // Note: tracking is conceptual here - you implement based on your needs
  const trackedKeys = ['posts', `user:${user.id}`];
  
  // 3. Render your page
  const html = await renderPage({ posts, user });
  
  // 4. Include Reality hydration state
  // Note: get the current state of tracked keys for hydration
  const realityState = {
    keys: trackedKeys,
    timestamp: Date.now(),
  };
  
  return new Response(
    html.replace('</body>', `
      <script>
        window.__REALITY_STATE__ = ${JSON.stringify(realityState)};
      </script>
    </body>`),
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// ============================================
// 4. Mutation handling
// ============================================

// Posts table schema placeholder
declare const postsTable: unknown;

// When data changes on the server:
async function handleMutation(request: Request) {
  const data = await request.json();
  
  // 1. Your normal database write
  const post = await db.insert(postsTable).values({
    title: data.title,
    content: data.content,
  }).returning();
  
  // 2. Tell embedded Reality that 'posts' changed
  // This updates the version hash
  await embeddedServer.invalidate(['posts']);
  
  // 3. If you have connected clients (hybrid SSR + live updates),
  // they'll receive the invalidation notification
  
  return Response.json(post);
}

// ============================================
// 5. Client hydration
// ============================================

// On the client side (after SSR hydration):
// Note: This code would run in the browser, not during SSR
function hydrateClient() {
  if (typeof window !== 'undefined') {
    // Get Reality state from SSR
    const ssrState = (window as unknown as { __REALITY_STATE__?: { keys: string[] } }).__REALITY_STATE__;
    
    // Subscribe to tracked keys for live updates
    if (ssrState?.keys) {
      ssrState.keys.forEach((key) => {
        reality.subscribe(key, (state) => {
          // Refetch changed data - implement your own refetch logic
          console.log('Key changed:', key, state);
        });
      });
    }
  }
}

// ============================================
// 6. Auto execution mode (recommended)
// ============================================

// If you're not sure about the environment, use 'auto' mode:
const autoReality = createReality({
  executionMode: 'auto',
  servers: [
    // Optional: fallback to external server if not in SSR
    'http://localhost:3456',
  ],
});

// 'auto' mode:
// - Uses embedded mode during SSR (server-side)
// - Uses HTTP/WS mode on client (browser-side)
// - Detects environment automatically

// ============================================
// Key Points:
// ============================================
//
// 1. 'ssr-embedded' mode = no external WebSocket server
// 2. Reality runs entirely in your SSR process
// 3. Perfect for Vercel, Cloudflare Workers, etc.
// 4. Still just tracks metadata - YOUR data, YOUR database
// 5. Can optionally connect to external servers for live updates
// 6. 'auto' mode detects the best option automatically

export { reality, embeddedServer, handleSSRRequest, handleMutation, autoReality, hydrateClient };
