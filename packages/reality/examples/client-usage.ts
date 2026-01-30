/**
 * @rootlodge/reality - Client Usage with External Server
 * 
 * This example shows the traditional client-server setup where
 * a Reality server runs externally and clients connect via HTTP.
 * 
 * Remember: Reality doesn't own your data. Your app fetches data
 * from YOUR database/API. Reality just tells you when to refetch.
 * 
 * NOTE: This is a documentation example. React hooks (useState, useEffect)
 * are shown in comments to illustrate patterns.
 */

import { createReality } from '@rootlodge/reality';

// ============================================
// 1. Create Reality client
// ============================================

const reality = createReality({
  // Connect to external Reality server(s)
  servers: [
    'http://localhost:3456',
    'http://backup.example.com:3456',  // Optional backup
  ],
  
  // Execution mode: 'client' for browser apps connecting to external servers
  executionMode: 'client',
  
  // Optional: Custom retry behavior
  maxRetries: 3,
  retryBaseDelay: 1000,
  timeout: 30000,
  
  // Optional: Enable debug logging
  debug: process.env.NODE_ENV === 'development',
});

// ============================================
// 2. Subscribe to changes
// ============================================

// Subscribe to specific nodes - one subscription per key
// (For multiple keys, create multiple subscriptions)
const unsubscribePosts = reality.subscribe(
  'posts',
  (state) => {
    console.log('Posts node changed:', state);
    // YOUR responsibility: refetch data from YOUR source
    fetchPosts();
  }
);

const unsubscribeUser = reality.subscribe(
  'user:123',
  (state) => {
    console.log('User node changed:', state);
    fetchUser('123');
  }
);

const unsubscribeComments = reality.subscribe(
  'comments',
  (state) => {
    console.log('Comments node changed:', state);
    fetchComments();
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

// When your app creates/updates/deletes data, tell Reality via sync
async function createPost(title: string, content: string) {
  // 1. Write to YOUR database (via your API)
  const response = await fetch('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  });
  const newPost = await response.json();
  
  // 2. Tell Reality that 'posts' changed by triggering a sync
  // This will pick up the new version from the server
  await reality.syncKeys(['posts'], 'mutation');
  
  return newPost;
}

// ============================================
// 5. React integration example (pseudocode)
// ============================================

// Using with React (you'd typically create a custom hook)
// This is shown as pseudocode - actual implementation would import React
//
// function usePosts() {
//   const [posts, setPosts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   
//   useEffect(() => {
//     // Initial fetch
//     fetchPosts().then(setPosts).finally(() => setLoading(false));
//     
//     // Subscribe to changes
//     const unsubscribe = reality.subscribe(['posts'], () => {
//       setLoading(true);
//       fetchPosts().then(setPosts).finally(() => setLoading(false));
//     });
//     
//     return unsubscribe;
//   }, []);
//   
//   return { posts, loading };
// }

// ============================================
// 6. Cleanup
// ============================================

// When your app unmounts or user logs out
function cleanup() {
  unsubscribePosts();
  unsubscribeUser();
  unsubscribeComments();
  reality.destroy();
}

// ============================================
// Key Points:
// ============================================
//
// 1. reality.subscribe(key, callback) - Listen for "something changed" notifications
// 2. reality.syncKeys([keys], hint) - Sync specific keys with server
// 3. Your data fetching is 100% your code - Reality doesn't touch it
// 4. Reality is just a coordination layer - it never sees your data
// 5. Works with any backend: REST, GraphQL, gRPC, direct DB, etc.

export { reality, createPost, cleanup };
