/**
 * NEW Reality Server Implementation
 * 
 * This file shows the Reality approach - efficient version-based sync.
 * Run with: bun run server
 * 
 * Benefits:
 * 1. Version-based invalidation - only fetch when data actually changed
 * 2. Lightweight sync checks - just version numbers, not full payloads
 * 3. Client fetches payload only when needed
 * 4. Massive reduction in bandwidth
 */

import { serve } from 'bun';
import { createRealityServer, MemoryStorage } from '@rootlodge/reality-server';
import { createHash } from '@rootlodge/reality';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// Initialize Reality server
const storage = new MemoryStorage();
const server = createRealityServer({
  serverId: `notification-server-${Date.now()}`,
  port: 3000,
}, storage);

const realityHandler = server.getFetchHandler('/reality');

// Simulated notification data
let notifications: Notification[] = [
  {
    id: '1',
    type: 'info',
    title: 'Welcome!',
    message: 'Thanks for trying the Reality demo.',
    timestamp: Date.now() - 60000,
    read: false,
  },
];

// Track statistics to show efficiency
let totalSyncRequests = 0;
let totalPayloadRequests = 0;
let syncBytesTransferred = 0;
let payloadBytesTransferred = 0;

// Update Reality node when notifications change
async function updateNotificationNode(): Promise<void> {
  // Create a hash of the current state
  const hash = createHash(JSON.stringify({
    ids: notifications.map(n => n.id),
    readStates: notifications.map(n => n.read),
  }));
  
  // Update the node - clients will detect version change
  await server.updateNode('notifications:all', hash);
}

// Initial node setup
updateNotificationNode();

// Add random notifications
function addRandomNotification(): void {
  const types: Notification['type'][] = ['info', 'warning', 'success', 'error'];
  const messages = [
    { title: 'New Comment', message: 'Someone commented on your post' },
    { title: 'System Update', message: 'A new version is available' },
    { title: 'Task Complete', message: 'Your export finished successfully' },
    { title: 'Warning', message: 'Storage is 80% full' },
    { title: 'New Follower', message: 'John Doe started following you' },
  ];
  
  const msg = messages[Math.floor(Math.random() * messages.length)];
  const type = types[Math.floor(Math.random() * types.length)];
  
  notifications.unshift({
    id: Date.now().toString(),
    type,
    title: msg.title,
    message: msg.message,
    timestamp: Date.now(),
    read: false,
  });
  
  notifications = notifications.slice(0, 20);
  
  // Update the Reality node
  updateNotificationNode();
}

function scheduleNextNotification(): void {
  const delay = 5000 + Math.random() * 10000;
  setTimeout(() => {
    addRandomNotification();
    scheduleNextNotification();
  }, delay);
}
scheduleNextNotification();

serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Reality sync endpoint - lightweight version check
    if (url.pathname === '/reality/sync') {
      totalSyncRequests++;
      const response = await realityHandler(request);
      
      // Track bytes (approximate)
      const body = await response.clone().text();
      syncBytesTransferred += body.length;
      
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(body, { status: response.status, headers });
    }
    
    // Payload endpoint - only called when version changed
    if (url.pathname === '/api/notifications') {
      totalPayloadRequests++;
      
      const response = JSON.stringify({
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      });
      
      payloadBytesTransferred += response.length;
      
      return new Response(response, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Mark notification as read
    if (url.pathname.match(/^\/api\/notifications\/\w+\/read$/) && request.method === 'PATCH') {
      const id = url.pathname.split('/')[3];
      const notification = notifications.find(n => n.id === id);
      if (notification) {
        notification.read = true;
        await updateNotificationNode();
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Polling compatibility endpoint
    if (url.pathname === '/api/notifications/poll') {
      // For clients not yet migrated to Reality
      const lastKnownVersion = url.searchParams.get('v');
      const currentNode = await storage.getNode('notifications:all');
      
      if (lastKnownVersion && currentNode && String(currentNode.version) === lastKnownVersion) {
        // No changes - return minimal response
        return new Response(JSON.stringify({ changed: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Data changed - return full payload with new version
      return new Response(JSON.stringify({
        changed: true,
        version: currentNode?.version ?? 1,
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Stats endpoint
    if (url.pathname === '/stats') {
      const totalBytes = syncBytesTransferred + payloadBytesTransferred;
      
      return new Response(JSON.stringify({
        syncRequests: totalSyncRequests,
        payloadRequests: totalPayloadRequests,
        syncBytesTransferred,
        payloadBytesTransferred,
        totalBytesTransferred: totalBytes,
        efficiencyNote: `Only ${totalPayloadRequests} payload fetches for ${totalSyncRequests} sync checks`,
        bandwidthSaved: totalSyncRequests > 0 
          ? `~${Math.round((1 - totalPayloadRequests / totalSyncRequests) * 100)}% reduction`
          : 'N/A',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log('✅ Reality Server running on http://localhost:3000');
console.log('');
console.log('Benefits over polling:');
console.log('   ✓ Version-based sync - only fetch when changed');
console.log('   ✓ Lightweight sync checks (~50 bytes vs full payload)');
console.log('   ✓ Massive bandwidth reduction');
console.log('   ✓ No polling intervals to tune');
console.log('');
console.log('Endpoints:');
console.log('  POST /reality/sync              - Version sync (lightweight)');
console.log('  GET  /api/notifications         - Full payload (when needed)');
console.log('  GET  /api/notifications/poll    - Polling compat endpoint');
console.log('  GET  /stats                     - Efficiency statistics');
