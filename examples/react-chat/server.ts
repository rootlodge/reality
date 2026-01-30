/**
 * React Chat Example - Server
 * 
 * Demonstrates a Reality-powered chat server with:
 * - In-memory storage (for demo simplicity)
 * - Full mesh awareness
 * - Optimistic update support
 */

import { createRealityServer, MemoryStorage } from '@rootlodge/reality-server';
import { createHash } from '@rootlodge/reality';

// Types
interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  pending?: boolean;
}

interface Room {
  id: string;
  name: string;
  messages: Message[];
  participants: string[];
}

// In-memory data store (use a real database in production)
const rooms = new Map<string, Room>();

// Initialize demo room
rooms.set('general', {
  id: 'general',
  name: 'General Chat',
  messages: [
    {
      id: '1',
      roomId: 'general',
      userId: 'system',
      username: 'System',
      text: 'Welcome to the Reality chat demo!',
      timestamp: Date.now() - 60000,
    },
  ],
  participants: [],
});

// Create Reality server
const storage = new MemoryStorage();
const server = createRealityServer({
  serverId: 'chat-server-1',
  port: 3001,
  debug: true,
}, storage);

// Set payload fetcher to return room data
server.setPayloadFetcher(async (key: string) => {
  const [type, , id] = key.split(':');
  
  if (type === 'chat' && id) {
    const room = rooms.get(id);
    if (room) {
      return room.messages;
    }
  }
  
  if (type === 'rooms') {
    return Array.from(rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      messageCount: r.messages.length,
      participantCount: r.participants.length,
    }));
  }
  
  return null;
});

// Initialize node versions
async function initializeNodes() {
  for (const [id, room] of rooms) {
    const hash = createHash(room.messages);
    await server.updateNode(`chat:room:${id}`, hash);
  }
  
  const roomsHash = createHash(Array.from(rooms.keys()));
  await server.updateNode('rooms:list', roomsHash);
}

// Get Fetch handler
const realityHandler = server.getFetchHandler('/reality');

// Simple HTTP server using Fetch API
const httpServer = Bun.serve({
  port: 3001,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // CORS for all routes
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Reality routes
    if (url.pathname.startsWith('/reality')) {
      return realityHandler(request);
    }

    // API routes
    if (url.pathname === '/api/messages' && request.method === 'POST') {
      const body = await request.json() as {
        roomId: string;
        userId: string;
        username: string;
        text: string;
      };

      const room = rooms.get(body.roomId);
      if (!room) {
        return new Response(JSON.stringify({ error: 'Room not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const message: Message = {
        id: crypto.randomUUID(),
        roomId: body.roomId,
        userId: body.userId,
        username: body.username,
        text: body.text,
        timestamp: Date.now(),
      };

      room.messages.push(message);

      // Update Reality node
      const hash = createHash(room.messages);
      await server.updateNode(`chat:room:${body.roomId}`, hash);

      return new Response(JSON.stringify(message), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (url.pathname.startsWith('/api/rooms/') && request.method === 'GET') {
      const roomId = url.pathname.split('/').pop();
      const room = rooms.get(roomId ?? '');
      
      if (!room) {
        return new Response(JSON.stringify({ error: 'Room not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response(JSON.stringify(room.messages), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
});

// Initialize
await initializeNodes();
console.log(`🚀 Chat server running at http://localhost:${httpServer.port}`);
console.log(`📡 Reality endpoint: http://localhost:${httpServer.port}/reality`);
