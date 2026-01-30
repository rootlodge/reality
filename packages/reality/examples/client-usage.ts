/**
 * @rootlodge/reality - Client Usage with External Server
 * 
 * This example shows the traditional client-server setup where
 * a Reality server runs externally and clients connect via WebSocket.
 * 
 * Remember: Reality doesn't own your data. Your app fetches data
 * from YOUR database/API. Reality just tells you when to refetch.
 */

import { createReality } from '@rootlodge/reality';

// ============================================
// 1. Create Reality client
// ============================================

const reality = createReality({
  // Connect to external Reality server(s)
  servers: [
    { url: 'ws://localhost:3456', weight: 1 },
    { url: 'ws://backup.example.com:3456', weight: 0.5 },  // Optional backup
  ],
  
  // Execution mode: 'client' for browser apps connecting to external servers
  executionMode: 'client',
  
  // Persistence: 'none' is fine - Reality only tracks metadata
  persistence: 'none',
  
  // Optional: Custom retry behavior
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
  },
  
  // Optional: Enable debug logging
  debug: process.env.NODE_ENV === 'development',
});

// ============================================
// 2. Subscribe to changes
// ============================================

// Subscribe to specific nodes - you decide what they represent
const unsubscribe = reality.subscribe(
  ['posts', 'user:123', 'comments'],
  (changedNodes) => {
    console.log('These nodes changed:', changedNodes);
    
    // YOUR responsibility: refetch data from YOUR source
    // Reality just told you something changed
    
    changedNodes.forEach(nodeKey => {
      if (nodeKey === 'posts') {
        // Refetch posts from your API
        fetchPosts();
      } else if (nodeKey.startsWith('user:')) {
        const userId = nodeKey.split(':')[1];
        fetchUser(userId);
      } else if (nodeKey === 'comments') {
        fetchComments();
      }
    });
  }
);

// ============================================
// 3. Your data fetching (YOU own this)
// ============================================

// These are YOUR functions - Reality doesn't provide them
// You fetch from YOUR database, API, or any source you want

async function fetchPosts() {
  const response = await fetch('/api/posts');
  const posts = await response.json();
  // Update your state management (React state, Zustand, Redux, etc.)
  return posts;
}

async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  const user = await response.json();
  return user;
}

async function fetchComments() {
  const response = await fetch('/api/comments');
  const comments = await response.json();
  return comments;
}

// ============================================
// 4. Notify Reality when YOU change data
// ============================================

// When your app creates/updates/deletes data, tell Reality
async function createPost(title: string, content: string) {
  // 1. Write to YOUR database (via your API)
  const response = await fetch('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  });
  const newPost = await response.json();
  
  // 2. Tell Reality that 'posts' changed
  // This broadcasts to other clients so they know to refetch
  await reality.sync({
    nodeKey: 'posts',
    version: Date.now().toString(),  // Simple version - you can use anything
  });
  
  return newPost;
}

// ============================================
// 5. React integration example
// ============================================

// Using with React (you'd typically create a custom hook)
function usePosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Initial fetch
    fetchPosts().then(setPosts).finally(() => setLoading(false));
    
    // Subscribe to changes
    const unsubscribe = reality.subscribe(['posts'], () => {
      setLoading(true);
      fetchPosts().then(setPosts).finally(() => setLoading(false));
    });
    
    return unsubscribe;
  }, []);
  
  return { posts, loading };
}

// ============================================
// 6. Cleanup
// ============================================

// When your app unmounts or user logs out
function cleanup() {
  unsubscribe();
  reality.disconnect();
}

// ============================================
// Key Points:
// ============================================
//
// 1. reality.subscribe() - Listen for "something changed" notifications
// 2. reality.sync() - Tell others "I changed something"  
// 3. Your data fetching is 100% your code - Reality doesn't touch it
// 4. Reality is just a coordination layer - it never sees your data
// 5. Works with any backend: REST, GraphQL, gRPC, direct DB, etc.

export { reality, usePosts, createPost, cleanup };
