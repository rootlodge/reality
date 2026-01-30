/**
 * @rootlodge/reality - SSR Embedded Mode Example
 * 
 * For SSR frameworks (TanStack Start, Next.js, Nuxt, etc.), you can run
 * Reality entirely in-process without any external WebSocket server.
 * 
 * This is the 'ssr-embedded' execution mode.
 */

import { 
  createReality, 
  createEmbeddedRealityServer,
  getSharedEmbeddedServer,
} from '@rootlodge/reality';
import { createEmbeddedRealityServer as createServer } from '@rootlodge/reality-server';

// ============================================
// 1. Create embedded server (runs in your SSR process)
// ============================================

// This runs IN your SSR process - no external server needed
const embeddedServer = createServer({
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
  
  // Reference to the embedded server
  embeddedServer: embeddedServer,
});

// ============================================
// 3. SSR request handling
// ============================================

// In your SSR request handler / route loader:
async function handleSSRRequest(request: Request) {
  // 1. Your normal data fetching
  const posts = await db.query.posts.findMany();
  const user = await db.query.users.findFirst({
    where: { id: getSession(request).userId }
  });
  
  // 2. Reality tracks what data was used in this render
  // This is useful for knowing what to invalidate later
  const renderContext = reality.createRenderContext();
  renderContext.track('posts');
  renderContext.track(`user:${user.id}`);
  
  // 3. Render your page
  const html = await renderPage({ posts, user });
  
  // 4. Include Reality hydration state
  const realityState = reality.serializeForHydration();
  
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

// When data changes on the server:
async function handleMutation(request: Request) {
  const data = await request.json();
  
  // 1. Your normal database write
  const post = await db.insert(posts).values({
    title: data.title,
    content: data.content,
  }).returning();
  
  // 2. Tell embedded Reality that 'posts' changed
  // This updates the version hash
  await embeddedServer.invalidate('posts');
  
  // 3. If you have connected clients (hybrid SSR + live updates),
  // they'll receive the invalidation notification
  
  return Response.json(post);
}

// ============================================
// 5. Client hydration
// ============================================

// On the client side (after SSR hydration):
if (typeof window !== 'undefined') {
  // Hydrate Reality state from SSR
  const ssrState = (window as any).__REALITY_STATE__;
  if (ssrState) {
    reality.hydrate(ssrState);
  }
  
  // Now subscribe to live updates
  reality.subscribe(['posts', 'user:123'], (changed) => {
    // Refetch changed data
    refetchQueries(changed);
  });
}

// ============================================
// 6. Auto execution mode (recommended)
// ============================================

// If you're not sure about the environment, use 'auto' mode:
const autoReality = createReality({
  executionMode: 'auto',
  servers: [
    // Optional: fallback to external server if not in SSR
    { url: 'ws://localhost:3456', weight: 1 },
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

export { reality, embeddedServer, handleSSRRequest, handleMutation };
