/**
 * OLD Polling Server Implementation
 * 
 * This file shows a traditional polling approach.
 * Run with: bun run server:old
 * 
 * Problems with polling:
 * 1. Wasteful - fetches full payload even when nothing changed
 * 2. Latency tradeoff - shorter intervals = more load, longer = stale data
 * 3. No way to know if data changed without fetching it
 * 4. Server must serialize full response every time
 */

import { serve } from 'bun';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// Simulated notification data
let notifications: Notification[] = [
  {
    id: '1',
    type: 'info',
    title: 'Welcome!',
    message: 'Thanks for trying the polling demo.',
    timestamp: Date.now() - 60000,
    read: false,
  },
];

// Track statistics to show inefficiency
let totalRequests = 0;
let totalBytesTransferred = 0;
let requestsWithNoChanges = 0;

// Add a random notification every 5-15 seconds
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
  
  // Keep only last 20 notifications
  notifications = notifications.slice(0, 20);
}

// Random interval for new notifications
function scheduleNextNotification(): void {
  const delay = 5000 + Math.random() * 10000; // 5-15 seconds
  setTimeout(() => {
    addRandomNotification();
    scheduleNextNotification();
  }, delay);
}
scheduleNextNotification();

serve({
  port: 3001,
  fetch(request) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Polling endpoint - returns FULL payload every time
    if (url.pathname === '/api/notifications') {
      totalRequests++;
      
      const response = JSON.stringify({
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      });
      
      totalBytesTransferred += response.length;
      
      // We have no way to know if client already has this data!
      // Every request transfers the full payload.
      
      return new Response(response, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Mark notification as read
    if (url.pathname.match(/^\/api\/notifications\/\w+\/read$/) && request.method === 'PATCH') {
      const id = url.pathname.split('/')[3];
      const notification = notifications.find(n => n.id === id);
      if (notification) {
        notification.read = true;
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Stats endpoint
    if (url.pathname === '/stats') {
      return new Response(JSON.stringify({
        totalRequests,
        totalBytesTransferred,
        requestsWithNoChanges,
        averageBytesPerRequest: totalRequests > 0 
          ? Math.round(totalBytesTransferred / totalRequests) 
          : 0,
        inefficiencyNote: 'Every request transfers full payload, even if nothing changed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
});

console.log('🔴 OLD Polling Server running on http://localhost:3001');
console.log('');
console.log('⚠️  Inefficiencies with polling:');
console.log('   - Every request transfers full payload');
console.log('   - No way to know if data changed');
console.log('   - More requests = more server load');
console.log('   - Longer intervals = stale data');
console.log('');
console.log('Endpoints:');
console.log('  GET   /api/notifications         - Get all notifications');
console.log('  PATCH /api/notifications/:id/read - Mark as read');
console.log('  GET   /stats                      - Transfer statistics');
