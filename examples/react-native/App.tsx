/**
 * Reality React Native Example
 * 
 * Demonstrates Reality's React Native support:
 * - Uses AppState for visibility tracking (not document.visibilityState)
 * - NetInfo for network status (not navigator.onLine)
 * - Same useReality hook works on both platforms
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { RealityProvider, useReality, useMutation } from '@rootlodge/reality';

// Types
interface Message {
  id: string;
  text: string;
  userId: string;
  username: string;
  timestamp: number;
  pending?: boolean;
}

interface User {
  id: string;
  username: string;
  avatar?: string;
  lastSeen: number;
  online: boolean;
}

// API endpoint - replace with your server URL
const API_URL = 'http://192.168.1.100:3000'; // Use your machine's IP for device testing
const REALITY_ENDPOINT = `${API_URL}/reality/sync`;

// Message List Component
function MessageList({ roomId }: { roomId: string }) {
  const { data: messages, isLoading, isSyncing, error, sync } = useReality<Message[]>(
    `chat:room:${roomId}`,
    {
      fallback: [],
      fetcher: async (key: string) => {
        const id = key.split(':').pop();
        const response = await fetch(`${API_URL}/api/rooms/${id}/messages`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        return response.json();
      },
      staleTime: 2000,
    }
  );

  const handleSync = async () => {
    await sync('interaction');
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleSync}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={styles.messageListContainer}>
      {isSyncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color="#00d4ff" />
          <Text style={styles.syncingText}>Syncing...</Text>
        </View>
      )}
      
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View style={[styles.message, item.pending && styles.messagePending]}>
            <Text style={styles.messageUsername}>{item.username}</Text>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>
              {new Date(item.timestamp).toLocaleTimeString()}
              {item.pending && ' • Sending...'}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Be the first to say something!</Text>
          </View>
        }
      />
    </View>
  );
}

// Message Input Component
function MessageInput({ roomId, userId, username }: { roomId: string; userId: string; username: string }) {
  const [text, setText] = React.useState('');

  const { mutate, isLoading } = useMutation<Message[], string>(
    `chat:room:${roomId}`,
    async (messageText: string) => {
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          text: messageText,
          userId,
          username,
        }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      // Return the updated messages array
      const newMessage = await response.json();
      const messagesResponse = await fetch(`${API_URL}/api/rooms/${roomId}/messages`);
      return messagesResponse.json();
    },
    {
      optimisticUpdate: (messages: Message[] | undefined, messageText: string): Message[] => [
        {
          id: `temp-${Date.now()}`,
          text: messageText,
          userId,
          username,
          timestamp: Date.now(),
          pending: true,
        },
        ...(messages ?? []),
      ],
      rollbackOnError: true,
    }
  );

  const handleSend = async () => {
    if (!text.trim() || isLoading) return;
    const messageText = text.trim();
    setText('');
    await mutate(messageText);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#8892b0"
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Online Users Component
function OnlineUsers({ roomId }: { roomId: string }) {
  const { data: users, isLoading } = useReality<User[]>(
    `presence:room:${roomId}`,
    {
      fallback: [],
      fetcher: async (key: string) => {
        const id = key.split(':').pop();
        const response = await fetch(`${API_URL}/api/rooms/${id}/users`);
        if (!response.ok) return [];
        return response.json();
      },
      staleTime: 5000,
    }
  );

  const onlineUsers = users?.filter((u: User) => u.online) ?? [];

  if (isLoading || onlineUsers.length === 0) {
    return null;
  }

  return (
    <View style={styles.onlineUsersContainer}>
      <Text style={styles.onlineUsersLabel}>
        {onlineUsers.length} online
      </Text>
      <View style={styles.onlineUsersDots}>
        {onlineUsers.slice(0, 5).map((user: User) => (
          <View key={user.id} style={styles.onlineDot} />
        ))}
        {onlineUsers.length > 5 && (
          <Text style={styles.onlineUsersMore}>+{onlineUsers.length - 5}</Text>
        )}
      </View>
    </View>
  );
}

// Chat Room Screen
function ChatRoom({ roomId }: { roomId: string }) {
  // In a real app, get this from auth context
  const userId = 'user-1';
  const username = 'Mobile User';

  return (
    <View style={styles.chatRoom}>
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>#{roomId}</Text>
        <OnlineUsers roomId={roomId} />
      </View>
      
      <MessageList roomId={roomId} />
      <MessageInput roomId={roomId} userId={userId} username={username} />
    </View>
  );
}

// Room List Screen
function RoomList({ onSelectRoom }: { onSelectRoom: (roomId: string) => void }) {
  const rooms = [
    { id: 'general', name: 'General', description: 'General discussion' },
    { id: 'random', name: 'Random', description: 'Off-topic chat' },
    { id: 'support', name: 'Support', description: 'Get help here' },
  ];

  return (
    <View style={styles.roomList}>
      <Text style={styles.roomListTitle}>Chat Rooms</Text>
      <Text style={styles.roomListSubtitle}>
        Powered by Reality - No WebSockets!
      </Text>
      
      {rooms.map(room => (
        <TouchableOpacity
          key={room.id}
          style={styles.roomItem}
          onPress={() => onSelectRoom(room.id)}
        >
          <Text style={styles.roomName}>#{room.name}</Text>
          <Text style={styles.roomDescription}>{room.description}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          • Syncs when app comes to foreground{'\n'}
          • Syncs when network reconnects{'\n'}
          • Optimistic updates for instant feel{'\n'}
          • No persistent connections needed
        </Text>
      </View>
    </View>
  );
}

// Main App
export default function App() {
  const [selectedRoom, setSelectedRoom] = React.useState<string | null>(null);

  return (
    <RealityProvider
      options={{
        servers: [API_URL],
        debug: true,
      }}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        {selectedRoom ? (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedRoom(null)}
            >
              <Text style={styles.backButtonText}>← Back to Rooms</Text>
            </TouchableOpacity>
            <ChatRoom roomId={selectedRoom} />
          </>
        ) : (
          <RoomList onSelectRoom={setSelectedRoom} />
        )}
      </SafeAreaView>
    </RealityProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  
  // Room List
  roomList: {
    flex: 1,
    padding: 20,
  },
  roomListTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e4e4e4',
    marginBottom: 4,
  },
  roomListSubtitle: {
    fontSize: 14,
    color: '#8892b0',
    marginBottom: 24,
  },
  roomItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00d4ff',
    marginBottom: 4,
  },
  roomDescription: {
    fontSize: 14,
    color: '#8892b0',
  },
  infoBox: {
    marginTop: 24,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d4ff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#ccd6f6',
    lineHeight: 22,
  },

  // Back Button
  backButton: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonText: {
    color: '#00d4ff',
    fontSize: 16,
  },

  // Chat Room
  chatRoom: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e4e4e4',
  },

  // Online Users
  onlineUsersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineUsersLabel: {
    fontSize: 12,
    color: '#10b981',
  },
  onlineUsersDots: {
    flexDirection: 'row',
    gap: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  onlineUsersMore: {
    fontSize: 10,
    color: '#8892b0',
    marginLeft: 4,
  },

  // Message List
  messageListContainer: {
    flex: 1,
  },
  syncingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  syncingText: {
    fontSize: 12,
    color: '#00d4ff',
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  message: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  messagePending: {
    opacity: 0.6,
  },
  messageUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00d4ff',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#e4e4e4',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#8892b0',
  },

  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#8892b0',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#8892b0',
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 14,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1a1a2e',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#e4e4e4',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#00d4ff',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(0, 212, 255, 0.3)',
  },
  sendButtonText: {
    color: '#1a1a2e',
    fontWeight: '600',
    fontSize: 16,
  },
});
